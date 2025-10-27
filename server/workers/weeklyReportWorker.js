import {
  buildProgressSummary,
  markWeeklyReportSent,
  loadUserTimezone,
  MAX_RETRY_ATTEMPTS
} from '../utils/weeklyProgress.js';

import {
  onesignalEnabled,
  updateOneSignalUser
} from '../utils/onesignal.js';

import {
  getLocalDateTimeParts,
  getNextWeekStart,
  normalizeTimezone
} from '../utils/week.js';
import { GEMINI_MODELS, buildWeeklyReportPrompt } from '../config/ai.js';

const RESEND_API_URL = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function convertBoldToHtml(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  let contentHtml = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('- ')) {
      if (!inList) {
        contentHtml += '<ul style="margin: 16px 0; padding-left: 24px; list-style-type: none;">';
        inList = true;
      }
      const listContent = convertBoldToHtml(escapeHtml(line.slice(2)));
      contentHtml += `<li style="margin: 8px 0; padding-left: 8px; position: relative;">
        <span style="position: absolute; left: -16px; color: #2dd4bf;">•</span>
        <span style="color: #334155; line-height: 1.6;">${listContent}</span>
      </li>`;
      continue;
    }

    if (inList) {
      contentHtml += '</ul>';
      inList = false;
    }

    if (line.startsWith('# ')) {
      const headerContent = convertBoldToHtml(escapeHtml(line.slice(2).trim()));
      contentHtml += `<h1 style="margin: 32px 0 16px; font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">${headerContent}</h1>`;
      continue;
    }

    if (line.startsWith('## ')) {
      const headerContent = convertBoldToHtml(escapeHtml(line.slice(3).trim()));
      contentHtml += `<h2 style="margin: 28px 0 14px; font-size: 22px; font-weight: 700; color: #0ea5e9; letter-spacing: -0.3px; border-bottom: 2px solid #e0f2fe; padding-bottom: 8px;">${headerContent}</h2>`;
      continue;
    }

    if (line.startsWith('### ')) {
      const headerContent = convertBoldToHtml(escapeHtml(line.slice(4).trim()));
      contentHtml += `<h3 style="margin: 24px 0 12px; font-size: 18px; font-weight: 600; color: #14b8a6;">${headerContent}</h3>`;
      continue;
    }

    if (line === '') {
      contentHtml += '<div style="margin: 16px 0;"></div>';
      continue;
    }

    const paragraphContent = convertBoldToHtml(escapeHtml(line));
    contentHtml += `<p style="margin: 14px 0; color: #475569; line-height: 1.7; font-size: 15px;">${paragraphContent}</p>`;
  }

  if (inList) {
    contentHtml += '</ul>';
  }

  // Get logo URL from environment variable or use a default
  const logoUrl = process.env.WEEKLY_REPORT_LOGO_URL || 'https://nuezhhuuwhqrapwznymn.supabase.co/storage/v1/object/public/assets/replay-logo.png';

  // Wrap content in a beautiful email template
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Weekly Replay</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">

              <!-- Header with logo and gradient -->
              <tr>
                <td style="background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%); padding: 48px 40px; text-align: center;">
                  <img src="${logoUrl}" alt="Replay Logo" style="width: 120px; height: auto; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;" />
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Your Weekly Reflection</h1>
                </td>
              </tr>

              <!-- Main content -->
              <tr>
                <td style="padding: 40px;">
                  ${contentHtml}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 32px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0 0 12px; color: #64748b; font-size: 14px; line-height: 1.6;">
                    Take a moment to reflect on your journey. Every step forward matters.
                  </p>
                  <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                    This is your weekly reflection from <strong style="color: #0ea5e9;">Replay</strong>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

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
    async sendEmail({ to, subject, html, text, tags, headers }) {
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
          tags,
          headers
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
    } catch (_error) {
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
    const model = gemini.getGenerativeModel({ model: GEMINI_MODELS.default });
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

    const prompt = buildWeeklyReportPrompt({
      notesDigest,
      meditationsDigest,
      profileSection,
      weekStart,
      timezone,
      profileValues
    });

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
    '',
    markdownSummary
  ].join('\n');

  const bodyMarkdown = statsBlock;

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

  if (!error && Object.prototype.hasOwnProperty.call(payload, 'eligible') && onesignalEnabled()) {
    try {
      await updateOneSignalUser(row.user_id, {
        weekly_report_eligible: payload.eligible ? 'true' : 'false'
      });
    } catch (tagError) {
      if (logger) {
        logger.warn(`Failed to sync weekly_report_eligible tag for ${row.user_id}:`, tagError instanceof Error ? tagError.message : tagError);
      }
    }
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

    if (onesignalEnabled()) {
      try {
        await updateOneSignalUser(userId, {
          weekly_report_eligible: 'false'
        });
      } catch (tagError) {
        logger.warn(`Failed to sync weekly_report_eligible tag after report send for ${userId}:`, tagError instanceof Error ? tagError.message : tagError);
      }
    }

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

export { createResendClientFromEnv };
export default createWeeklyReportWorker;
