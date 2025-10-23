const FREE_USAGE_LIMITS = Object.freeze({
  journals: 10,
  meditations: 2
});

const usageCache = new Map();
const USAGE_CACHE_TTL_MS = 60 * 1000;

function usageCacheKey(userId) {
  return `usage:${userId}`;
}

function getCachedSummary(userId) {
  const entry = usageCache.get(usageCacheKey(userId));
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    usageCache.delete(usageCacheKey(userId));
    return null;
  }
  return entry.value;
}

function setCachedSummary(userId, summary) {
  usageCache.set(usageCacheKey(userId), {
    expiresAt: Date.now() + USAGE_CACHE_TTL_MS,
    value: summary
  });
}

function formatUsageRow(row) {
  const journalTotal = Math.max(row?.journal_total ?? 0, 0);
  const meditationTotal = Math.max(row?.meditation_total ?? 0, 0);

  return {
    journals: {
      total: journalTotal,
      limit: FREE_USAGE_LIMITS.journals,
      remaining: Math.max(FREE_USAGE_LIMITS.journals - journalTotal, 0)
    },
    meditations: {
      total: meditationTotal,
      limit: FREE_USAGE_LIMITS.meditations,
      remaining: Math.max(FREE_USAGE_LIMITS.meditations - meditationTotal, 0)
    },
    updatedAt: row?.updated_at ?? null,
    source: row ? 'db' : 'default'
  };
}

export function invalidateUsageSummary(userId) {
  usageCache.delete(usageCacheKey(userId));
}

export async function getUsageSummary({ supabase, userId, bypassCache = false }) {
  if (!userId || !supabase) {
    return formatUsageRow(null);
  }

  if (!bypassCache) {
    const cached = getCachedSummary(userId);
    if (cached) {
      return cached;
    }
  }

  const { data, error } = await supabase
    .from('usage_counters')
    .select('user_id, journal_total, meditation_total, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[Usage] Failed to load usage counters:', error.message);
  }

  const summary = formatUsageRow(data ?? null);
  setCachedSummary(userId, summary);
  return summary;
}

export async function incrementUsageCounters({ supabase, userId, journalDelta = 0, meditationDelta = 0 }) {
  if (!supabase || !userId) {
    return null;
  }

  if (!journalDelta && !meditationDelta) {
    return getUsageSummary({ supabase, userId });
  }

  const { data, error } = await supabase.rpc('increment_usage_counters', {
    p_user_id: userId,
    journal_delta: journalDelta,
    meditation_delta: meditationDelta
  });

  if (error) {
    throw new Error(`[Usage] Failed to increment counters: ${error.message}`);
  }

  invalidateUsageSummary(userId);
  const summary = formatUsageRow(data ?? null);
  setCachedSummary(userId, summary);
  return summary;
}

export { FREE_USAGE_LIMITS };
