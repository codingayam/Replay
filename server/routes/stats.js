export function registerStatsRoutes(deps) {
  const { app, requireAuth, supabase } = deps;

  app.get('/api/stats/calendar', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth.userId;

      const { data: completedMeditations, error: meditationsError } = await supabase
        .from('meditations')
        .select('completed_at')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (meditationsError) {
        console.error('Error fetching calendar data:', meditationsError);
        return res.status(500).json({ error: 'Failed to get calendar data' });
      }

      const { data: journalNotes, error: notesError } = await supabase
        .from('notes')
        .select('date, created_at')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (notesError) {
        console.error('Error fetching calendar data:', notesError);
        return res.status(500).json({ error: 'Failed to get calendar data' });
      }

      const reflectionDates = (completedMeditations || []).map((entry) =>
        new Date(entry.completed_at).toISOString().split('T')[0]
      );

      const journalDates = (journalNotes || []).map((entry) => {
        const rawDate = entry?.date || entry?.created_at;
        if (!rawDate) {
          return null;
        }
        if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          return rawDate;
        }
        return new Date(rawDate).toISOString().split('T')[0];
      }).filter((value) => Boolean(value));

      const uniqueReflections = [...new Set(reflectionDates)];
      const uniqueJournals = [...new Set(journalDates)];

      res.json({
        reflections: uniqueReflections,
        journals: uniqueJournals,
        dates: uniqueReflections
      });
    } catch (error) {
      console.error('Calendar stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
