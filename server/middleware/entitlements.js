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
    const entitlements = await getRevenuecatEntitlements(userId);
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
