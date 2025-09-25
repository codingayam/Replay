export function registerAccountRoutes({ app, requireAuth, supabase }) {
  const STORAGE_BUCKETS = ['profiles', 'images', 'audio', 'meditations'];
  const DELETE_CHUNK_SIZE = 100;

  const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  };

  const collectStorageFiles = async (bucket, prefix) => {
    const files = [];
    const limit = 100;

    const walkFolder = async (path) => {
      let page = 0;
      while (true) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .list(path, {
            limit,
            offset: page * limit,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (error) {
          if (error.statusCode === 404 || error.statusCode === '404') {
            return;
          }
          throw new Error(`Failed to list storage paths for bucket ${bucket}: ${error.message}`);
        }

        if (!data || data.length === 0) {
          break;
        }

        for (const item of data) {
          if (!item?.name || item.name === '.' || item.name === '..') {
            continue;
          }
          const itemPath = path ? `${path}/${item.name}` : item.name;
          if (item.metadata) {
            files.push(itemPath);
          } else {
            await walkFolder(itemPath);
          }
        }

        if (data.length < limit) {
          break;
        }
        page += 1;
      }
    };

    await walkFolder(prefix);
    return files;
  };

  const deleteStoragePrefix = async (bucket, userId) => {
    try {
      const files = await collectStorageFiles(bucket, userId);
      if (files.length === 0) {
        return;
      }

      for (const chunk of chunkArray(files, DELETE_CHUNK_SIZE)) {
        const { error } = await supabase.storage.from(bucket).remove(chunk);
        if (error) {
          throw new Error(`Failed to remove files from bucket ${bucket}: ${error.message}`);
        }
      }
    } catch (error) {
      throw new Error(`Storage cleanup failed for bucket ${bucket}: ${error.message}`);
    }
  };

  app.delete('/api/account', requireAuth(), async (req, res) => {
    const userId = req.auth?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const encounteredErrors = [];

    // Clean up storage assets
    for (const bucket of STORAGE_BUCKETS) {
      try {
        await deleteStoragePrefix(bucket, userId);
      } catch (error) {
        console.error(error);
        encounteredErrors.push({ scope: 'storage', bucket, message: error.message });
      }
    }

    const tableDeletions = [
      { table: 'scheduled_notifications', column: 'user_id' },
      { table: 'notification_history', column: 'user_id' },
      { table: 'notification_devices', column: 'user_id' },
      { table: 'notification_preferences', column: 'user_id' },
      { table: 'meditation_jobs', column: 'user_id' },
      { table: 'meditations', column: 'user_id' },
      { table: 'notes', column: 'user_id' },
      { table: 'profiles', column: 'user_id' },
    ];

    for (const { table, column } of tableDeletions) {
      const { error } = await supabase.from(table).delete().eq(column, userId);
      if (error) {
        console.error(`Failed to delete from ${table} for user ${userId}:`, error);
        encounteredErrors.push({ scope: 'table', table, message: error.message });
      }
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error(`Failed to delete Supabase auth user ${userId}:`, deleteUserError);
      encounteredErrors.push({ scope: 'auth', message: deleteUserError.message });
    }

    if (encounteredErrors.length > 0) {
      return res.status(500).json({
        error: 'Account deletion completed with errors.',
        details: encounteredErrors,
      });
    }

    return res.json({ success: true });
  });
}

export default registerAccountRoutes;
