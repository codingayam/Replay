const DEFAULT_TIMEZONE = 'America/New_York';
const WEEKDAY_MAP = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function normalizeTimezone(timezone) {
  return timezone || DEFAULT_TIMEZONE;
}

function getLocalDateParts(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const [year, month, day] = formatter
    .format(date)
    .split('-')
    .map((part) => Number.parseInt(part, 10));

  return {
    year,
    month,
    day,
    dateString: `${pad(year)}-${pad(month)}-${pad(day)}`
  };
}

function getLocalDateTimeParts(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const hour = lookup.hour ?? '00';
  const minute = lookup.minute ?? '00';
  const second = lookup.second ?? '00';

  return {
    date: `${lookup.year}-${lookup.month}-${lookup.day}`,
    time: `${hour}:${minute}:${second}`
  };
}

function getWeekdayIndex(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const weekdayLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  }).format(date);

  return WEEKDAY_MAP[weekdayLabel] ?? 0;
}

function getWeekStart(date = new Date(), timezone) {
  const tz = normalizeTimezone(timezone);
  const { year, month, day } = getLocalDateParts(date, tz);
  const weekStartDate = new Date(Date.UTC(year, month - 1, day));
  const weekdayIndex = getWeekdayIndex(date, tz);

  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - weekdayIndex);
  return weekStartDate.toISOString().slice(0, 10);
}

function addDaysToDateString(dateString, days) {
  const [year, month, day] = dateString.split('-').map((part) => Number.parseInt(part, 10));
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString().slice(0, 10);
}

function getNextWeekStart(weekStart) {
  return addDaysToDateString(weekStart, 7);
}

function getTimezoneOffsetMs(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const year = Number.parseInt(parts.year, 10);
  const month = Number.parseInt(parts.month, 10);
  const day = Number.parseInt(parts.day, 10);
  const hour = Number.parseInt(parts.hour, 10);
  const minute = Number.parseInt(parts.minute, 10);
  const second = Number.parseInt(parts.second, 10);

  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  return localTimestamp - date.getTime();
}

function getUtcFromLocalDate(dateString, timezone, timeString = '00:00:00') {
  const [year, month, day] = dateString.split('-').map((part) => Number.parseInt(part, 10));
  const [hour, minute, second] = timeString.split(':').map((part) => Number.parseInt(part, 10));

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcDate = new Date(naiveUtc);
  const offset = getTimezoneOffsetMs(utcDate, timezone);
  const target = new Date(naiveUtc - offset);
  return target.toISOString();
}

function computeNextReportAtUtc(weekStart, timezone) {
  if (!weekStart) {
    return null;
  }
  const tz = normalizeTimezone(timezone);
  const nextWeekStart = getNextWeekStart(weekStart);
  return getUtcFromLocalDate(nextWeekStart, tz, '00:00:00');
}

function hasReachedLocalMoment({ targetDate, targetTime = '00:00:00', timezone, now = new Date() }) {
  const tz = normalizeTimezone(timezone);
  const { date: currentDate, time: currentTime } = getLocalDateTimeParts(now, tz);

  if (currentDate > targetDate) {
    return true;
  }

  if (currentDate < targetDate) {
    return false;
  }

  return currentTime >= targetTime;
}

async function getUserTimezone(supabase, userId) {
  if (!supabase || !userId) {
    return DEFAULT_TIMEZONE;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load user timezone, falling back to default:', error.message);
      return DEFAULT_TIMEZONE;
    }

    return normalizeTimezone(data?.timezone);
  } catch (error) {
    console.warn('Unexpected error loading timezone, falling back to default:', error.message);
    return DEFAULT_TIMEZONE;
  }
}

export {
  DEFAULT_TIMEZONE,
  addDaysToDateString,
  getLocalDateParts,
  getLocalDateTimeParts,
  getNextWeekStart,
  getUserTimezone,
  getWeekStart,
  hasReachedLocalMoment,
  normalizeTimezone,
  computeNextReportAtUtc,
  getUtcFromLocalDate
};
