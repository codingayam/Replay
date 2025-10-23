import { revenuecatEnabled, getRevenuecatConfig } from '../config/revenuecat.js';

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1/subscribers';
const cache = new Map();

function now() {
  return Date.now();
}

function getCacheKey(userId) {
  return `rc:${userId}`;
}

function getCachedEntitlements(userId) {
  const key = getCacheKey(userId);
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedEntitlements(userId, value, ttlMs) {
  const key = getCacheKey(userId);
  cache.set(key, {
    expiresAt: now() + ttlMs,
    value
  });
}

function parseEntitlements(payload) {
  const subscriber = payload?.subscriber ?? {};
  const entitlements = subscriber.entitlements ?? {};
  const active = [];
  const nowIso = new Date();

  for (const [identifier, entitlement] of Object.entries(entitlements)) {
    if (!entitlement) {
      continue;
    }
    const isActive = entitlement.active === true ||
      entitlement.expires_date === null ||
      (entitlement.expires_date && new Date(entitlement.expires_date) > nowIso);
    if (isActive) {
      active.push({
        identifier,
        expiresAt: entitlement.expires_date ?? null,
        productIdentifier: entitlement.product_identifier ?? null,
        store: entitlement.store ?? null
      });
    }
  }

  const primary = active[0] ?? null;
  const latestExpiration = active.reduce((latest, entitlement) => {
    if (!entitlement.expiresAt) {
      return latest;
    }
    const expiresAtMs = new Date(entitlement.expiresAt).getTime();
    if (!latest || expiresAtMs > latest) {
      return expiresAtMs;
    }
    return latest;
  }, null);

  return {
    isPremium: active.length > 0,
    activeEntitlements: active,
    expiresAt: latestExpiration ? new Date(latestExpiration).toISOString() : (primary?.expiresAt ?? null)
  };
}

async function fetchEntitlements(userId) {
  const config = getRevenuecatConfig();
  const url = `${REVENUECAT_API_BASE}/${encodeURIComponent(userId)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Platform': 'web'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`RevenueCat request failed with status ${response.status}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }

  const payload = await response.json();
  return parseEntitlements(payload);
}

export async function getRevenuecatEntitlements(userId, options = {}) {
  const { forceRefresh = false } = options;
  if (!revenuecatEnabled() || !userId) {
    return {
      isPremium: false,
      activeEntitlements: [],
      expiresAt: null,
      source: 'disabled'
    };
  }

  if (!forceRefresh) {
    const cached = getCachedEntitlements(userId);
    if (cached) {
      return { ...cached, source: 'cache' };
    }
  }

  try {
    const data = await fetchEntitlements(userId);
    const config = getRevenuecatConfig();
    setCachedEntitlements(userId, data, config.cacheTtlMs);
    return { ...data, source: 'api' };
  } catch (error) {
    console.error('[RevenueCat] Failed to fetch entitlements:', error);
    return {
      isPremium: false,
      activeEntitlements: [],
      expiresAt: null,
      source: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function invalidateRevenuecatEntitlements(userId) {
  const key = getCacheKey(userId);
  cache.delete(key);
}
