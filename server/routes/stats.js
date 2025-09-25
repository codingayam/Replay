import { calculateStreak } from '../utils/stats.js';

export function registerStatsRoutes(deps) {
  const { app, requireAuth, supabase } = deps;

  app.get('/api/stats/streak', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;

      const { data: completedMeditations, error } = await supabase
        .from('meditations')
        .select('completed_at')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching completed meditations for streak:', error);
        return res.status(500).json({ error: 'Failed to calculate streak' });
      }

      const completions = completedMeditations || [];
      const currentStreak = calculateStreak(completions);
      const lastCompletionDate = completions.length > 0 ? completions[0].completed_at : null;
      const today = new Date().toDateString();
      const completedToday = lastCompletionDate
        ? new Date(lastCompletionDate).toDateString() === today
        : false;

      res.json({
        streak: currentStreak,
        currentStreak,
        lastCompletionDate,
        completedToday
      });
    } catch (error) {
      console.error('Streak calculation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/stats/monthly', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;

      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data: completedMeditations, error } = await supabase
        .from('meditations')
        .select('id')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .gte('completed_at', startOfMonth.toISOString())
        .lte('completed_at', endOfMonth.toISOString());

      if (error) {
        console.error('Error fetching monthly stats:', error);
        return res.status(500).json({ error: 'Failed to get monthly count' });
      }

      const count = Array.isArray(completedMeditations) ? completedMeditations.length : 0;
      res.json({ count });
    } catch (error) {
      console.error('Monthly stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/stats/calendar', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;

      const { data: completedMeditations, error } = await supabase
        .from('meditations')
        .select('completed_at')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching calendar data:', error);
        return res.status(500).json({ error: 'Failed to get calendar data' });
      }

      const dates = (completedMeditations || []).map((entry) =>
        new Date(entry.completed_at).toISOString().split('T')[0]
      );

      const uniqueDates = [...new Set(dates)];
      res.json({ dates: uniqueDates });
    } catch (error) {
      console.error('Calendar stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

