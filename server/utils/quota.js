import { getUserTimezone, getWeekStart, getUtcFromLocalDate, getNextWeekStart } from './week.js';

const DEFAULT_WEEKLY_LIMIT = 2;
const usageCache = new Map();
const USAGE_CACHE_TTL_MS = 60 * 1000; // 1 minute cache to reduce repeated queries within same request burst

function usageCacheKey(userId) {
  return `meditations:${userId}`;
}

function getCachedUsage(userId) {
  const key = usageCacheKey(userId);
  const entry = usageCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    usageCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedUsage(userId, value) {
  const key = usageCacheKey(userId);
  usageCache.set(key, {
    expiresAt: Date.now() + USAGE_CACHE_TTL_MS,
    value
  });
}

export function invalidateMeditationUsage(userId) {
  usageCache.delete(usageCacheKey(userId));
}

export async function getMeditationWeeklyUsage({ supabase, userId }) {
  if (!userId || !supabase) {
    return {
      weeklyCount: 0,
      weeklyLimit: DEFAULT_WEEKLY_LIMIT,
      remaining: DEFAULT_WEEKLY_LIMIT,
      weekStart: null,
      weekResetAt: null
    };
  }

  const cached = getCachedUsage(userId);
  if (cached) {
    return cached;
  }

  const timezone = await getUserTimezone(supabase, userId);
  const weekStartLocal = getWeekStart(new Date(), timezone);
  const weekStartUtc = getUtcFromLocalDate(weekStartLocal, timezone, '00:00:00');
  const nextWeekLocal = getNextWeekStart(weekStartLocal);
  const weekResetAt = getUtcFromLocalDate(nextWeekLocal, timezone, '00:00:00');

  const { count, error } = await supabase
    .from('meditations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('created_at', weekStartUtc);

  if (error) {
    console.warn('[Quota] Failed to calculate meditation usage:', error.message);
  }

  const weeklyCount = count ?? 0;
  const weeklyLimit = DEFAULT_WEEKLY_LIMIT;
  const remaining = Math.max(weeklyLimit - weeklyCount, 0);

  const usage = {
    weeklyCount,
    weeklyLimit,
    remaining,
    weekStart: weekStartLocal,
    weekResetAt
  };

  setCachedUsage(userId, usage);
  return usage;
}
