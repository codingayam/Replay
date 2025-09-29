import {
  buildProgressSummary,
  markWeeklyReportSent,
  loadUserTimezone,
  MAX_RETRY_ATTEMPTS
} from '../utils/weeklyProgress.js';

import {
  getLocalDateTimeParts,
  getNextWeekStart,
  normalizeTimezone
} from '../utils/week.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  let html = '<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul style="padding-left: 20px;">';
        inList = true;
      }
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += '</ul>';
      inList = false;
    }

    if (line.startsWith('# ')) {
      html += `<h2 style="margin: 24px 0 12px;">${escapeHtml(line.slice(2).trim())}</h2>`;
      continue;
    }

    if (line.startsWith('## ')) {
      html += `<h3 style="margin: 20px 0 10px;">${escapeHtml(line.slice(3).trim())}</h3>`;
      continue;
    }

    if (line.startsWith('### ')) {
      html += `<h4 style="margin: 16px 0 8px;">${escapeHtml(line.slice(4).trim())}</h4>`;
      continue;
    }

    if (line === '') {
      html += '<p style="margin: 12px 0;">&nbsp;</p>';
      continue;
    }

    html += `<p style="margin: 12px 0;">${escapeHtml(line)}</p>`;
  }

  if (inList) {
    html += '</ul>';
  }

  html += '</div>';
  return html;
}

function markdownToText(markdown) {
  return markdown
    .replace(/\*\*/g, '')
    .replace(/#+\s?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function createResendClientFromEnv(fetchImpl = fetch) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.WEEKLY_REPORT_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return null;
  }

  return {
    fromEmail,
    async sendEmail({ to, subject, html, text, tags }) {
      const response = await fetchImpl(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: fromEmail,
          to,
          subject,
          html,
          text,
          tags
        })
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Resend API error (${response.status}): ${details}`);
      }

      return response.json();
    }
  };
}

async function fetchWeekNotes(supabase, userId, weekStart) {
  const nextWeekStart = getNextWeekStart(weekStart);
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, transcript, date, type')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lt('date', nextWeekStart)
    .order('date', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function fetchCompletedMeditations(supabase, userId, weekStart) {
  const nextWeekStart = getNextWeekStart(weekStart);
  const { data, error } = await supabase
    .from('meditations')
    .select('id, title, completed_at, summary')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', weekStart)
    .lt('completed_at', nextWeekStart)
    .order('completed_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function getUserContact(supabase, userId) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  if (!user?.email) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, values, mission, thinking_about')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    email: user.email,
    profile: {
      name: profile?.name ?? null,
      values: profile?.values ?? null,
      mission: profile?.mission ?? null,
      thinking_about: profile?.thinking_about ?? null
    }
  };
}

function formatDateInTimezone(value, timezone) {
  if (!value) {
    return '';
  }
  const parts = getLocalDateTimeParts(new Date(value), timezone);
  return `${parts.date} ${parts.time}`;
}

function formatProfileValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

async function generateGeminiSummary(gemini, { notes, meditations, timezone, weekStart, profile = null }) {
  if (!gemini || typeof gemini.getGenerativeModel !== 'function') {
    return null;
  }

  try {
    const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const notesDigest = notes.length > 0
      ? notes.map((note) => `- ${note.date}: ${note.title}\n${note.transcript || ''}`).join('\n')
      : 'No journal entries were recorded this week.';

    const meditationsDigest = meditations.length > 0
      ? meditations.map((med) => {
          const details = med.summary ? `\n${med.summary}` : '';
          return `- ${med.title} (${med.completed_at})${details}`;
        }).join('\n')
      : 'No meditations were completed this week.';

    const profileLines = [];
    const profileName = formatProfileValue(profile?.name);
    if (profileName) {
      profileLines.push(`Preferred name: ${profileName}`);
    }
    const profileValues = formatProfileValue(profile?.values);
    if (profileValues) {
      profileLines.push(`Personal values: ${profileValues}`);
    }
    const profileMission = formatProfileValue(profile?.mission);
    if (profileMission) {
      profileLines.push(`Life mission or focus: ${profileMission}`);
    }
    const profileThinkingAbout = formatProfileValue(profile?.thinking_about);
    if (profileThinkingAbout) {
      profileLines.push(`Currently thinking about: ${profileThinkingAbout}`);
    }

    const profileSection = profileLines.length > 0
      ? `\nUser profile context:\n${profileLines.join('\n')}\n`
      : '';

    const prompt = `You are a thoughtful coach and facilitator helping someone gain deeper self-understanding through their own reflections and thoughts. Your role is to serve as a mirror and gentle guide, helping them see patterns, connections, and insights they may not have noticed themselves. 

    Core Approach
    -Never prescriptive: You don't tell them what to do or think. Instead, you help them discover their own answers
    -Pattern recognition: Identify recurring themes, concerns, or aspirations across their shared thoughts
    -Gentle illumination: Shine light on connections and insights without imposing interpretations
    -Curious questioning: Ask open-ended questions that deepen their self-exploration
    -Respectful witnessing: Honor their journey and validate their experiences while maintaining professional boundaries

    Your Process
    -Synthesize without reducing: Look for patterns across their reflections while preserving the richness of their individual thoughts
    -Notice the threads:
      What themes appear repeatedly?
      What values consistently emerge?
      Where do their energy and passion seem strongest?
      What tensions or paradoxes exist in their thinking?
    -Reflect back with care:
      "I notice you've mentioned [X] several times..."
      "There seems to be a connection between [Y] and [Z] in your reflections..."
      "Your thoughts about [topic] have evolved from [earlier view] to [current view]..."
    -Offer observations, not conclusions:
      Present what you notice as possibilities, not facts
      Use tentative language: "It seems...", "Perhaps...", "I wonder if..."
      Invite them to confirm, modify, or reject your observations
    -Ask powerful questions:
      "What does this pattern tell you about yourself?"
      "How does this align with your stated values of [X]?"
      "What might be possible if you fully embraced this aspect of yourself?"
      "Where else in your life do you see this theme playing out?"

    Key Areas to Explore
    -Alignment: How do their actions, thoughts, and stated values align or diverge?
    -Growth edges: Where are they stretching or challenging themselves?
    -Resistance points: What do they seem to avoid or struggle with repeatedly?
    -Energy sources: What consistently energizes or depletes them?
    -Evolution: How have their perspectives shifted over time?
    -Integration: How might separate insights connect into a larger understanding?

    Your Tone
    -Warm but professional
    -Curious without being intrusive
    -Supportive without enabling
    -Clear without being harsh
    -Encouraging growth while accepting where they are

    The person recorded their reflections during the week starting ${weekStart} in timezone ${timezone}.

    Output Structure
    -When providing your crystallized view:
      Opening reflection: Acknowledge the depth and breadth of what they've shared
    -Key patterns observed: Present 3-5 major themes you've noticed
    -Connections and insights: Show how different elements of their reflections relate
    -Questions for deeper exploration: Offer 2-3 powerful questions for them to consider
    -Affirmation: Recognize their growth, courage, or insights
    -Invitation: End with an open invitation for them to share what resonates and what they can continue to keep in mind or let ruminate in their subconscious as they go about their week.

IMPORTANT: You are not the expert on their life—they are. Your role is to help them see themselves more clearly through careful attention, pattern recognition, and thoughtful questioning. Trust their wisdom and capacity for self-discovery while providing the structure and reflection that facilitates deeper understanding. Be empathetic and kind - NEVER BE CRUEL, HARSH, JUDGEMENTAL OR CONDESCENDING.

${profileSection}Journal entries:
${notesDigest}

Meditations completed:
${meditationsDigest}
`;

    const result = await model.generateContent(prompt);
    return result.response.text()?.trim() || null;
  } catch (error) {
    console.warn('Gemini weekly summary generation failed:', error.message);
    return null;
  }
}

function buildFallbackSummary({ notes, meditations, timezone, weekStart }) {
  const hasNotes = notes.length > 0;
  const hasMeditations = meditations.length > 0;
  const noteSummary = hasNotes
    ? notes.map((note) => `- ${formatDateInTimezone(note.date, timezone)} — ${note.title || 'Untitled entry'}`).join('\n')
    : '- No journals recorded this week. Try capturing one reflection each day.';

  const meditationSummary = hasMeditations
    ? meditations.map((med) => `- ${formatDateInTimezone(med.completed_at, timezone)} — ${med.title || 'Meditation session'}`).join('\n')
    : '- No guided sessions completed. Consider scheduling a calming meditation to start next week.';

  return [
    `## Highlights for the week of ${weekStart}`,
    hasNotes
      ? '- You captured moments worth revisiting. Great job staying curious!'
      : '- Your journal was quiet this week. Try setting a reminder to record a quick reflection.',
    hasMeditations
      ? '- You made time for guided pauses—keep nurturing that momentum.'
      : '- Create space for stillness next week by booking a meditation in advance.',
    '',
    '## Journals revisited',
    noteSummary,
    '',
    '## Meditation moments',
    meditationSummary,
    '',
    '_Take a breath, notice how far you have come, and choose one gentle intention for the week ahead._'
  ].join('\n');
}

async function buildEmailPayload({
  row,
  timezone,
  notes,
  meditations,
  gemini,
  profile = null
}) {
  const progressSummary = buildProgressSummary(row, timezone);
  const baseSummary = await generateGeminiSummary(gemini, {
    notes,
    meditations,
    timezone,
    weekStart: row.week_start,
    profile
  });
  const markdownSummary = baseSummary ?? buildFallbackSummary({ notes, meditations, timezone, weekStart: row.week_start });

  const statsBlock = [
    '## Activity snapshot',
    `- Journals created: ${progressSummary.journalCount}`,
    `- Meditations completed: ${progressSummary.meditationCount}`,
    `- Report ready since: ${row.weekly_report_ready_at ?? 'not recorded'}`,
    '',
    markdownSummary
  ].join('\n');

  const bodyMarkdown = [
    `# Weekly reflection (${row.week_start})`,
    `Timezone: ${timezone}`,
    '',
    statsBlock
  ].join('\n');

  const subject = `Your Replay weekly reflection · Week of ${row.week_start}`;

  return {
    subject,
    bodyMarkdown,
    html: markdownToHtml(bodyMarkdown),
    text: markdownToText(bodyMarkdown)
  };
}

function resolveNow(nowInput) {
  if (nowInput instanceof Date) {
    return nowInput;
  }
  if (typeof nowInput === 'string' || typeof nowInput === 'number') {
    return new Date(nowInput);
  }
  return new Date();
}

async function releaseClaim({ supabase, row, updates = {}, logger }) {
  const payload = {
    claimed_at: null,
    updated_at: new Date().toISOString(),
    ...updates
  };

  const { error } = await supabase
    .from('weekly_progress')
    .update(payload)
    .eq('id', row.id)
    .single();

  if (error && logger) {
    logger.error(`Failed to release claim for user ${row.user_id}`, error);
  }
}

async function scheduleRetry({ supabase, row, delayMs, logger }) {
  const nextAttempts = (row.retry_attempts ?? 0) + 1;
  const disable = nextAttempts > MAX_RETRY_ATTEMPTS;
  const updates = {
    retry_attempts: nextAttempts,
  };

  if (!disable) {
    updates.next_report_at_utc = new Date(Date.now() + delayMs).toISOString();
  } else if (logger) {
    logger.error(`Max retry attempts reached for user ${row.user_id}; disabling weekly report for week ${row.week_start}`);
    updates.eligible = false;
    updates.retry_attempts = nextAttempts;
    updates.next_report_at_utc = null;
  }

  await releaseClaim({ supabase, row, updates, logger });

  return nextAttempts;
}

export function createWeeklyReportWorker({
  supabase,
  gemini,
  resendClient = null,
  logger = console,
  fetchImpl = fetch
}) {
  const client = resendClient ?? createResendClientFromEnv(fetchImpl);

  async function processRow(row, nowInput) {
    const nowDate = resolveNow(nowInput);
    const userId = row.user_id;

    if (!row.eligible || row.weekly_report_sent_at) {
      await releaseClaim({ supabase, row, logger });
      return false;
    }

    const dueDate = row.next_report_at_utc ? new Date(row.next_report_at_utc) : null;
    if (!dueDate || dueDate.getTime() > nowDate.getTime()) {
      await releaseClaim({ supabase, row, logger });
      return false;
    }

    const timezone = normalizeTimezone(await loadUserTimezone({ supabase, userId }));

    const contact = await getUserContact(supabase, userId);
    if (!contact?.email) {
      logger.warn(`Skipping weekly report for ${userId}: no email on file`);
      await releaseClaim({
        supabase,
        row,
        updates: { eligible: false, next_report_at_utc: null },
        logger
      });
      return false;
    }

    const notes = await fetchWeekNotes(supabase, userId, row.week_start);
    const meditations = await fetchCompletedMeditations(supabase, userId, row.week_start);
    const profileContext = contact?.profile ?? null;
    const payload = await buildEmailPayload({
      row,
      timezone,
      notes,
      meditations,
      gemini,
      profile: profileContext
    });

    if (!client) {
      logger.warn('Resend client not configured; weekly report email not sent');
      await releaseClaim({
        supabase,
        row,
        updates: { eligible: false, next_report_at_utc: null },
        logger
      });
      return false;
    }

    const sendResult = await client.sendEmail({
      to: [contact.email],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      tags: [{ name: 'category', value: 'weekly-report' }]
    });

    const sentAt = new Date().toISOString();

    await supabase
      .from('weekly_reports')
      .upsert({
        user_id: userId,
        week_start: row.week_start,
        subject: payload.subject,
        body_markdown: payload.bodyMarkdown,
        sent_at: sentAt,
        message_id: sendResult?.id ?? null
      }, { onConflict: 'user_id,week_start' });

    await markWeeklyReportSent({
      supabase,
      userId,
      weekStart: row.week_start,
      sentAt,
      messageId: sendResult?.id ?? null,
      subject: payload.subject
    });

    logger.info(`Weekly report sent to ${contact.email} for week ${row.week_start}`);
    return true;
  }

  async function run(now = new Date()) {
    if (!supabase) {
      throw new Error('Supabase client is required for weekly report worker');
    }

    const nowDate = resolveNow(now);
    const nowIso = nowDate.toISOString();
    const claimTimestamp = new Date().toISOString();

  const { data: rows, error } = await supabase
      .from('weekly_progress')
      .update({ claimed_at: claimTimestamp })
      .eq('eligible', true)
      .is('claimed_at', null)
      .is('weekly_report_sent_at', null)
      .lte('next_report_at_utc', nowIso)
      .select('*')
      .order('next_report_at_utc', { ascending: true })
      .limit(25);

    if (error) {
      logger.error('Failed to claim weekly progress rows for reports:', error);
      return { processed: 0, sent: 0 };
    }

    let sent = 0;
    let processed = 0;

    for (const row of rows ?? []) {
      processed += 1;
      try {
        const delivered = await processRow(row, nowDate);
        if (delivered) {
          sent += 1;
        }
      } catch (processingError) {
        logger.error(`Weekly report processing failed for user ${row.user_id}:`, processingError);
        await scheduleRetry({
          supabase,
          row,
          delayMs: 5 * 60 * 1000,
          logger
        });
      }
    }

    return { processed, sent };
  }

  return {
    run,
    processRow
  };
}

export default createWeeklyReportWorker;
