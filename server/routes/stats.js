export function registerStatsRoutes(deps) {
  const { app, requireAuth, supabase } = deps;

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
