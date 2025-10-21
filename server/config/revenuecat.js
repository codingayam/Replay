const DEFAULT_CACHE_TTL_SECONDS = 300;

function parseNumber(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const revenuecatConfig = {
  secretKey: process.env.REVENUECAT_SECRET_KEY ?? '',
  projectId: process.env.REVENUECAT_PROJECT_ID ?? '',
  cacheTtlMs: parseNumber(process.env.REVENUECAT_CACHE_TTL_SECONDS, DEFAULT_CACHE_TTL_SECONDS) * 1000
};

export function revenuecatEnabled() {
  return Boolean(revenuecatConfig.secretKey);
}

export function getRevenuecatConfig() {
  return revenuecatConfig;
}
