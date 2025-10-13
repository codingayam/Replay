import {
  buildProgressSummary as buildProgressSummaryDefault,
  loadUserTimezone as loadUserTimezoneDefault
} from '../utils/weeklyProgress.js';

import {
  DEFAULT_TIMEZONE,
  addDaysToDateString,
  getLocalDateTimeParts,
  getUtcFromLocalDate,
  getWeekStart,
  normalizeTimezone
} from '../utils/week.js';

import { createResendClientFromEnv } from './weeklyReportWorker.js';

const REMINDER_DAY_OFFSET = 3; // Thursday
const REMINDER_TIME = '19:00:00';
const DEADLINE_DAY_OFFSET = 6; // Sunday
const DEADLINE_TIME = '23:59:00';
const MAX_BATCH = 50;
const HTML_RAW_KEYS = new Set(['CTA_URL', 'SUPPORT_EMAIL']);

const DEFAULT_APP_ORIGIN = process.env.APP_ORIGIN
  ?? process.env.WEB_APP_URL
  ?? process.env.CLIENT_ORIGIN
  ?? 'https://app.replay.so';

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@replay.so';

const HTML_TEMPLATE = `<!doctype html>
<html lang="en" style="margin:0;padding:0;">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Weekly Reminder</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .bg { background: #0b0b10 !important; }
        .card { background: #16161d !important; color: #eaeaf2 !important; }
        .muted { color: #b8b8c7 !important; }
        .divider { border-color: #2a2a36 !important; }
        .btn { background: #4c7ef3 !important; color: #ffffff !important; }
        .pill { background: #232332 !important; color: #eaeaf2 !important; }
      }
      @media screen and (max-width: 600px) {
        .container { padding: 20px !important; }
        .h1 { font-size: 22px !important; line-height: 28px !important; }
        .btn { display: block !important; width: 100% !important; }
      }
    </style>
  </head>
  <body class="bg" style="margin:0;padding:0;background:#f5f6fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f6fb;">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
            <tr>
              <td align="left" class="container card" style="background:#ffffff;border-radius:14px;padding:32px;font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1f2330;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-size:14px;color:#7a8093;">Replay</td>
                    <td align="right" style="font-size:12px;color:#9aa0b4;">Weekly reminder</td>
                  </tr>
                </table>
                <div style="height:16px;"></div>
                <h1 class="h1" style="margin:0 0 8px 0;font-size:24px;line-height:32px;font-weight:700;">
                  Hey {{FIRST_NAME}}, you’re close to unlocking this week’s meditation
                </h1>
                <p class="muted" style="margin:0 0 20px 0;color:#5e6478;font-size:14px;line-height:22px;">
                  Here’s what’s left to hit the criteria and unlock your weekly report + guided meditation:
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="pill" style="background:#f0f3ff;color:#2c3a97;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:600;">
                      {{JOURNAL_REMAINING}} {{JOURNAL_LABEL}} left
                    </td>
                    <td style="width:8px;"></td>
                    <td class="pill" style="background:#f0f3ff;color:#2c3a97;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:600;">
                      {{MEDITATION_REMAINING}} {{MEDITATION_LABEL}} left
                    </td>
                  </tr>
                </table>
                <div style="height:16px;"></div>
                <hr class="divider" style="border:none;border-top:1px solid #eceff5;margin:0 0 16px 0;" />
                <p style="margin:0 0 10px 0;font-size:14px;line-height:22px;color:#1f2330;">
                  Why it matters:
                </p>
                <ul style="margin:0 0 20px 20px;padding:0;color:#1f2330;">
                  <li style="margin-bottom:8px;">Weekly report reveals your patterns so you can adjust next week.</li>
                  <li style="margin-bottom:8px;">The guided meditation is tailored to your inputs—integrate the week, don’t just log it.</li>
                  <li>Consistency compounds. Small entries now build future clarity.</li>
                </ul>
                <p class="muted" style="margin:0 0 20px 0;color:#5e6478;font-size:13px;">
                  Deadline: <strong style="color:#1f2330;">{{DEADLINE_LOCAL}}</strong>
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" bgcolor="#4c7ef3" style="border-radius:10px;">
                      <a class="btn" href="{{CTA_URL}}" target="_blank" 
                         style="display:inline-block;background:#4c7ef3;color:#ffffff;text-decoration:none;font-weight:700;
                                font-size:14px;line-height:20px;padding:12px 18px;border-radius:10px;">
                        Log today’s entry →
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="height:18px;"></div>
                <p class="muted" style="margin:0 0 6px 0;color:#5e6478;font-size:13px;">
                  Tip: a 60-second voice note counts. Capture one thought, one feeling, one action.
                </p>
                <div style="height:24px;"></div>
                <hr class="divider" style="border:none;border-top:1px solid #eceff5;margin:0 0 16px 0;" />
                <p class="muted" style="margin:0 0 8px 0;color:#7a8093;font-size:12px;">
                  You’re receiving this because weekly reminders are enabled for your account.
                </p>
                <p class="muted" style="margin:0;color:#7a8093;font-size:12px;">
                  Need help? <a href="mailto:{{SUPPORT_EMAIL}}" style="color:#4c7ef3;text-decoration:none;">Contact support</a>.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:12px 8px;color:#9aa0b4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;">
                © {{YEAR}} Replay — All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const TEXT_TEMPLATE = `Hey {{FIRST_NAME}}, you’re close to unlocking this week’s meditation.\n\nLeft to complete:\n- {{JOURNAL_REMAINING}} {{JOURNAL_LABEL}}\n- {{MEDITATION_REMAINING}} {{MEDITATION_LABEL}}\n\nWhy it matters:\n• Your weekly report shows patterns so next week is smarter.\n• The guided meditation helps integrate what you learned.\n• Consistency compounds.\n\nDeadline: {{DEADLINE_LOCAL}}\n\nLog today’s entry: {{CTA_URL}}\n\nNeed help? Email {{SUPPORT_EMAIL}}.`;

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTemplate(template, variables, { html = false } = {}) {
  let output = template;
  for (const [key, rawValue] of Object.entries(variables)) {
    const value = String(rawValue ?? '');
    const replacement = html && !HTML_RAW_KEYS.has(key) ? escapeHtml(value) : value;
    const pattern = new RegExp(`{{${key}}}`, 'g');
    output = output.replace(pattern, replacement);
  }
  return output;
}

function stripTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function formatLocalDateTime(dateString, timeString, timezone) {
  const [year, month, day] = dateString.split('-').map((part) => Number.parseInt(part, 10));
  const [hour, minute, second] = timeString.split(':').map((part) => Number.parseInt(part, 10));
  const baseDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  return formatter.format(baseDate);
}

async function fetchUserContact(supabase, userId) {
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
    .select('name')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    email: user.email,
    name: profile?.name ?? null
  };
}

function firstNameFromProfile(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.split(/\s+/)[0];
}

function buildCtaUrl() {
  const origin = stripTrailingSlash(DEFAULT_APP_ORIGIN);
  return `${origin}/experiences`;
}

function createWeeklyReportReminderWorker({
  supabase,
  logger = console,
  fetchImpl = fetch,
  resendClient,
  weeklyProgressOverrides = {}
} = {}) {
  if (!supabase) {
    throw new Error('Supabase client is required for weekly report reminder worker');
  }

  const buildProgressSummary = weeklyProgressOverrides.buildProgressSummary ?? buildProgressSummaryDefault;
  const loadUserTimezone = weeklyProgressOverrides.loadUserTimezone ?? loadUserTimezoneDefault;
  const resend = resendClient ?? createResendClientFromEnv(fetchImpl);

  async function resolveWeekTimezone(row) {
    const existing = row.week_timezone ? normalizeTimezone(row.week_timezone) : null;
    if (existing) {
      return existing;
    }

    const tz = normalizeTimezone(await loadUserTimezone({ supabase, userId: row.user_id }) ?? DEFAULT_TIMEZONE);
    await supabase
      .from('weekly_progress')
      .update({ week_timezone: tz })
      .eq('user_id', row.user_id)
      .eq('week_start', row.week_start);
    row.week_timezone = tz;
    return tz;
  }

  async function releaseAttempt(row) {
    await supabase
      .from('weekly_progress')
      .update({ weekly_report_reminder_attempted_at: null })
      .eq('user_id', row.user_id)
      .eq('week_start', row.week_start);
  }

  async function markReminderSent(row, timezone, sentAtIso) {
    await supabase
      .from('weekly_progress')
      .update({
        weekly_report_reminder_sent_at: sentAtIso,
        week_timezone: timezone
      })
      .eq('user_id', row.user_id)
      .eq('week_start', row.week_start);
  }

  async function run(now = new Date()) {
    const results = {
      processed: 0,
      sent: 0,
      skippedBeforeWindow: 0,
      skippedEligible: 0,
      missingEmail: 0,
      disabled: false,
      failed: 0
    };

    if (!resend) {
      logger.warn('Weekly report reminder worker disabled - missing Resend configuration');
      results.disabled = true;
      return results;
    }

    const claimTimestamp = new Date(now).toISOString();
    const currentWeekStart = getWeekStart(now, DEFAULT_TIMEZONE);

    const { data: candidates, error } = await supabase
      .from('weekly_progress')
      .update({ weekly_report_reminder_attempted_at: claimTimestamp })
      .eq('week_start', currentWeekStart)
      .is('weekly_report_sent_at', null)
      .is('weekly_report_reminder_sent_at', null)
      .is('weekly_report_reminder_attempted_at', null)
      .select('*')
      .limit(MAX_BATCH);

    if (error) {
      logger.error('Failed to claim weekly report reminder rows:', error);
      return results;
    }

    for (const row of candidates ?? []) {
      results.processed += 1;

      try {
        const timezone = await resolveWeekTimezone(row);
        const reminderDate = addDaysToDateString(row.week_start, REMINDER_DAY_OFFSET);
        const scheduledAtUtc = getUtcFromLocalDate(reminderDate, timezone, REMINDER_TIME);
        const scheduledAt = new Date(scheduledAtUtc);

        if (now.getTime() < scheduledAt.getTime()) {
          await releaseAttempt(row);
          results.skippedBeforeWindow += 1;
          continue;
        }

        const summary = buildProgressSummary(row, timezone);
        if (summary.reportReady) {
          results.skippedEligible += 1;
          continue;
        }

        const contact = await fetchUserContact(supabase, row.user_id);
        if (!contact?.email) {
          logger.warn(`Skipping weekly reminder for user ${row.user_id}: missing email`);
          results.missingEmail += 1;
          continue;
        }

        const firstName = firstNameFromProfile(contact.name) ?? 'there';
        const journalRemaining = summary.reportJournalRemaining;
        const meditationRemaining = summary.reportMeditationRemaining;
        const journalLabel = journalRemaining === 1 ? 'journal' : 'journals';
        const meditationLabel = meditationRemaining === 1 ? 'meditation' : 'meditations';
        const deadlineDate = addDaysToDateString(row.week_start, DEADLINE_DAY_OFFSET);
        const deadlineLocal = formatLocalDateTime(deadlineDate, DEADLINE_TIME, timezone);
        const ctaUrl = buildCtaUrl();
        const year = String(new Date(now).getFullYear());

        const templateVariables = {
          FIRST_NAME: firstName,
          JOURNAL_REMAINING: journalRemaining,
          JOURNAL_LABEL: journalLabel,
          MEDITATION_REMAINING: meditationRemaining,
          MEDITATION_LABEL: meditationLabel,
          DEADLINE_LOCAL: deadlineLocal,
          CTA_URL: ctaUrl,
          SUPPORT_EMAIL: SUPPORT_EMAIL,
          YEAR: year
        };

        const html = renderTemplate(HTML_TEMPLATE, templateVariables, { html: true });
        const text = renderTemplate(TEXT_TEMPLATE, templateVariables);

        const subject = `Halfway there — ${journalRemaining} ${journalLabel} + ${meditationRemaining} ${meditationLabel} to go`;
        const weekStartIso = row.week_start;
        const idempotencyKey = `weekly-reminder:${row.user_id}:${weekStartIso}`;

        await resend.sendEmail({
          to: [contact.email],
          subject,
          html,
          text,
          headers: {
            'X-Entity-Ref-ID': idempotencyKey
          },
          tags: [
            { name: 'category', value: 'weekly-report-reminder' },
            { name: 'week_start', value: weekStartIso }
          ]
        });

        await markReminderSent(row, timezone, new Date(now).toISOString());
        results.sent += 1;
      } catch (sendError) {
        logger.error(`Weekly report reminder failed for user ${row.user_id}:`, sendError instanceof Error ? sendError.message : sendError);
        await releaseAttempt(row);
        results.failed += 1;
      }
    }

    return results;
  }

  return { run };
}

export { createWeeklyReportReminderWorker };
