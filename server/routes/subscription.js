import { getMeditationWeeklyUsage } from '../utils/quota.js';

export function registerSubscriptionRoutes(deps) {
  const { app, requireAuth, attachEntitlements, supabase } = deps;

  app.get('/api/subscription/status', requireAuth(), attachEntitlements, async (req, res) => {
    try {
      const userId = req.auth.userId;
      const entitlements = req.entitlements ?? {
        isPremium: false,
        activeEntitlements: [],
        expiresAt: null
      };

      const usage = await getMeditationWeeklyUsage({ supabase, userId });

      res.json({
        entitlements: {
          isPremium: Boolean(entitlements.isPremium),
          expiresAt: entitlements.expiresAt ?? null,
          activeEntitlements: entitlements.activeEntitlements ?? [],
          source: entitlements.source ?? 'unknown'
        },
        limits: {
          meditations: usage,
          photoNotes: {
            allowed: Boolean(entitlements.isPremium),
            remaining: entitlements.isPremium ? null : 0,
            limit: entitlements.isPremium ? null : 0
          },
          textNoteImages: {
            allowed: Boolean(entitlements.isPremium),
            limit: entitlements.isPremium ? 10 : 0
          }
        }
      });
    } catch (error) {
      console.error('Subscription status error:', error);
      res.status(500).json({ error: 'Failed to load subscription status' });
    }
  });
}
