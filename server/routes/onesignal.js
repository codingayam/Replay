import { recomputeWeeklyProgress as recomputeWeeklyProgressDefault } from '../utils/weeklyTagSync.js';
import {
  attachExternalIdToSubscription,
  onesignalEnabled
} from '../utils/onesignal.js';

function getSubscriptionIdFromHeader(req) {
  const header = req.headers?.['x-onesignal-subscription-id'];
  if (!header) {
    return null;
  }
  if (Array.isArray(header)) {
    return header[0]?.trim() || null;
  }
  if (typeof header === 'string') {
    return header.trim() || null;
  }
  return null;
}

export function registerOneSignalRoutes({
  app,
  requireAuth,
  supabase,
  recomputeWeeklyProgress = recomputeWeeklyProgressDefault,
  onesignalOverrides = {}
}) {
  const resolveOnesignalEnabled = onesignalOverrides.onesignalEnabled ?? onesignalEnabled;
  const resolveAttachAlias = onesignalOverrides.attachExternalIdToSubscription ?? attachExternalIdToSubscription;

  app.post('/internal/onesignal/sync-tags', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const bodySubscription = typeof req.body?.subscriptionId === 'string'
        ? req.body.subscriptionId.trim()
        : null;
      const headerSubscription = getSubscriptionIdFromHeader(req);
      const subscriptionId = bodySubscription || headerSubscription || null;

      const result = await recomputeWeeklyProgress({
        supabase,
        userId,
        now: new Date(),
        logger: console
      });

      if (subscriptionId && resolveOnesignalEnabled()) {
        try {
          await resolveAttachAlias(subscriptionId, userId);
        } catch (error) {
          console.warn('[OneSignal] Failed to attach alias during sync-tags route:', {
            userId,
            subscriptionId,
            error: error instanceof Error ? error.message : error
          });
        }
      }

      res.json({
        status: result.updated ? 'updated' : 'skipped',
        weekKey: result.weekKey,
        tags: result.tags,
        summary: result.summary,
        lastSyncAt: result.lastSyncAt
      });
    } catch (error) {
      console.error('OneSignal sync-tags route error:', error);
      res.status(500).json({ error: 'Failed to sync OneSignal tags' });
    }
  });
}

export default registerOneSignalRoutes;
