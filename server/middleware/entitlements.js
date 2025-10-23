import { getRevenuecatEntitlements } from '../utils/revenuecat.js';

export async function attachEntitlements(req, _res, next) {
  const userId = req.auth?.userId;
  if (!userId) {
    req.entitlements = {
      isPremium: false,
      activeEntitlements: [],
      expiresAt: null,
      source: 'unauthenticated'
    };
    return next();
  }

  try {
    const rawForceParam = req.query?.forceRefresh ?? req.headers?.['x-revenuecat-force-refresh'];
    const forceRefresh = Array.isArray(rawForceParam)
      ? rawForceParam.some((value) => typeof value === 'string' && (value === '1' || value.toLowerCase() === 'true'))
      : typeof rawForceParam === 'string'
        ? rawForceParam === '1' || rawForceParam.toLowerCase() === 'true'
        : false;

    const entitlements = await getRevenuecatEntitlements(userId, { forceRefresh });
    req.entitlements = entitlements;
  } catch (error) {
    console.error('[RevenueCat] attachEntitlements failed:', error);
    req.entitlements = {
      isPremium: false,
      activeEntitlements: [],
      expiresAt: null,
      source: 'error'
    };
  }

  return next();
}
