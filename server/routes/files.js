export function registerFileRoutes(deps) {
  const { app, requireAuth, supabase } = deps;

  const createHandler = (bucket) => async (req, res) => {
    try {
      const { userId, filename } = req.params;
      const authUserId = req.auth.userId;

      if (userId !== authUserId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const filePath = `${userId}/${filename}`;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);

      if (error) {
        console.error(`${bucket} signed URL error:`, error);
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({ signedUrl: data.signedUrl });
    } catch (error) {
      console.error(`${bucket} file serving error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  app.get('/api/files/profiles/:userId/:filename', requireAuth(), createHandler('profiles'));
  app.get('/api/files/images/:userId/:filename', requireAuth(), createHandler('images'));
  app.get('/api/files/audio/:userId/:filename', requireAuth(), createHandler('audio'));
}

