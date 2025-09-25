export function registerNotificationRoutes(deps) {
  const {
    app,
    requireAuth,
    supabase,
    notificationService,
    getMetricsSnapshot,
    recordTokenRegistration,
    moment,
    notificationMetricsToken
  } = deps;

  const NOTIFICATION_METRICS_TOKEN = notificationMetricsToken;

  const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const VALID_WEEK_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];
  const DEFAULT_SCHEDULE_TIMES = {
    daily_reminder: '20:00',
    streak_reminder: '21:00',
    weekly_reflection: '19:00'
  };

  function dayStringToIndex(day) {
    if (!day) return null;
    const lower = day.toLowerCase();
    const index = VALID_WEEK_DAYS.indexOf(lower);
    return index === -1 ? null : index;
  }

  function validateNotificationPreferences(preferences) {
    if (!preferences || typeof preferences !== 'object') {
      return 'Preferences must be an object';
    }

    if (typeof preferences.enabled !== 'boolean') {
      return 'Preferences.enabled must be a boolean';
    }

    const validateToggle = (key, value, { requiresTime = false, requiresDay = false } = {}) => {
      if (value == null || typeof value !== 'object') {
        return `${key} preferences must be an object`;
      }

      if (typeof value.enabled !== 'boolean') {
        return `${key}.enabled must be a boolean`;
      }

      if (requiresTime && value.time && !TIME_REGEX.test(value.time)) {
        return `${key}.time must be in HH:MM format`;
      }

      if (requiresTime && value.enabled && !value.time) {
        return `${key}.time is required when enabled`;
      }

      if (requiresDay && value.day) {
        const index = dayStringToIndex(value.day);
        if (index == null) {
          return `${key}.day must be a valid weekday name`;
        }
      }
    };

    const checks = [
      ['daily_reminder', { requiresTime: true }],
      ['streak_reminder', { requiresTime: true }],
      ['meditation_ready', {}],
      ['weekly_reflection', { requiresTime: true, requiresDay: true }],
      ['replay_radio', { requiresTime: true }],
      ['achievements', {}]
    ];

    for (const [key, options] of checks) {
      if (preferences[key]) {
        const err = validateToggle(key, preferences[key], options);
        if (err) return err;
      }
    }

    return null;
  }

  async function syncProfileTimezoneFromDevice(userId, deviceTimezone) {
    if (!deviceTimezone || typeof deviceTimezone !== 'string') {
      return;
    }

    if (!moment.tz.zone(deviceTimezone)) {
      return;
    }

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile for timezone sync:', profileError);
        return;
      }

      const currentTimezone = profileRow?.timezone;
      if (currentTimezone === deviceTimezone) {
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ timezone: deviceTimezone })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error auto-updating timezone from device:', updateError);
        return;
      }

      console.log(`🌍 Auto-synced timezone for user ${userId} to ${deviceTimezone}`);

      await notificationService.logEvent(userId, 'timezone_synced_from_device', 'server', {
        deviceTimezone,
        previousTimezone: currentTimezone || null
      });
    } catch (error) {
      console.error('Timezone sync error:', error);
    }
  }

  // =============================================================================
  // PUSH NOTIFICATIONS API ENDPOINTS
  // =============================================================================

  // Token management - Save FCM or APNs token for user
  app.post('/api/notifications/token', requireAuth(), async (req, res) => {
    try {
      const {
        token,
        channel,
        browser,
        userAgent,
        appVersion,
        platform,
        deviceId,
        deviceName,
        language,
        timezone: deviceTimezone
      } = req.body;
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!token || !channel) {
        return res.status(400).json({ error: 'Token and channel are required' });
      }

      if (!['fcm', 'apns'].includes(channel)) {
        return res.status(400).json({ error: 'Channel must be either "fcm" or "apns"' });
      }

      // Normalize and validate token
      let normalizedToken;
      try {
        normalizedToken = notificationService.normalizeToken(token, channel);
      } catch (validationError) {
        return res.status(400).json({ error: validationError.message });
      }

      const nowIso = new Date().toISOString();
      const normalizedPlatformCandidate = platform || browser || (channel === 'apns' ? 'safari' : 'web');
      const normalizedPlatform = typeof normalizedPlatformCandidate === 'string'
        ? normalizedPlatformCandidate.toLowerCase()
        : null;

      const devicePayload = {
        user_id: userId,
        token: normalizedToken,
        push_provider: channel,
        platform: normalizedPlatform,
        timezone: deviceTimezone || null,
        app_version: appVersion || null,
        device_id: deviceId || null,
        device_name: deviceName || browser || null,
        language: language || null,
        last_registered_at: nowIso,
        updated_at: nowIso
      };

      if (userAgent && !devicePayload.device_name) {
        devicePayload.device_name = userAgent.slice(0, 255);
      }

      const { error } = await supabase
        .from('notification_devices')
        .upsert(devicePayload, { onConflict: 'token' });

      if (error) {
      recordTokenRegistration({
        channel,
        browser: browser || normalizedPlatform || 'unknown',
        status: 'failed'
        });

        await notificationService.logEvent(userId, 'notification_token_registration_failed', 'client', {
          channel,
          platform: normalizedPlatform,
          error: error.message
        });

        console.error('Error updating push token:', error);
        return res.status(500).json({ error: 'Failed to update push token' });
      }

      if (deviceTimezone) {
        await syncProfileTimezoneFromDevice(userId, deviceTimezone);
      }

      recordTokenRegistration({
        channel,
        browser: browser || normalizedPlatform || 'unknown',
        status: 'success'
      });

      await notificationService.logEvent(userId, 'notification_token_registered', 'client', {
        channel,
        platform: normalizedPlatform,
        deviceId: deviceId || null,
        language: language || null
      });

      console.log(`✅ Push device registered for user ${userId}, channel: ${channel}`);
      res.json({ success: true });

    } catch (error) {
      console.error('Token management error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Token validation and health check endpoint
  app.post('/api/notifications/token/validate', requireAuth(), async (req, res) => {
    try {
      const userId = req.user.id;

      const { data: devices, error } = await supabase
        .from('notification_devices')
        .select('push_provider, token, last_registered_at, updated_at, created_at')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching notification devices:', error);
        return res.status(500).json({ error: 'Failed to fetch user tokens' });
      }

      const providerStatus = (provider) => {
        const providerDevices = (devices || [])
          .filter((device) => device.push_provider === provider && device.token);

        if (!providerDevices.length) {
          return { hasToken: false, isValid: false, lastUpdated: null };
        }

        providerDevices.sort((a, b) => {
          const aDate = new Date(a.last_registered_at || a.updated_at || a.created_at || 0);
          const bDate = new Date(b.last_registered_at || b.updated_at || b.created_at || 0);
          return bDate - aDate;
        });

        const latest = providerDevices[0];
        const lastUpdated = latest.last_registered_at || latest.updated_at || latest.created_at;
        const tokenLength = latest.token?.length || 0;
        const minLength = provider === 'apns' ? 20 : 50;

        return {
          hasToken: true,
          isValid: tokenLength >= minLength,
          lastUpdated
        };
      };

      const fcmStatus = providerStatus('fcm');
      const apnsStatus = providerStatus('apns');

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const needsRefresh = [fcmStatus, apnsStatus]
        .filter((status) => status.hasToken && status.lastUpdated)
        .some((status) => new Date(status.lastUpdated) < thirtyDaysAgo);

      res.json({
        fcm: fcmStatus,
        apns: apnsStatus,
        needsRefresh
      });

    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Token deletion/cleanup endpoint
  app.delete('/api/notifications/token/:channel', requireAuth(), async (req, res) => {
    try {
      const { channel } = req.params;
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!['fcm', 'apns', 'all'].includes(channel)) {
        return res.status(400).json({ error: 'Channel must be fcm, apns, or all' });
      }

      const deleteQuery = supabase
        .from('notification_devices')
        .delete()
        .eq('user_id', userId);

      if (channel !== 'all') {
        deleteQuery.eq('push_provider', channel);
      }

      const { error } = await deleteQuery;

      if (error) {
        console.error('Error deleting push tokens:', error);
        return res.status(500).json({ error: 'Failed to delete push tokens' });
      }

      console.log(`✅ Push tokens deleted for user ${userId}, channel: ${channel}`);
      res.json({ success: true, message: `${channel} tokens deleted successfully` });

    } catch (error) {
      console.error('Token deletion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get notification preferences
  app.get('/api/notifications/preferences', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [{ data: prefRows, error: prefError }, { data: profileRows, error: profileError }] = await Promise.all([
        supabase
          .from('notification_preferences')
          .select('preferences')
          .eq('user_id', userId)
          .limit(1),
        supabase
          .from('profiles')
          .select('push_channel_preference')
          .eq('user_id', userId)
          .limit(1)
      ]);

      if (prefError || profileError) {
        console.error('Error fetching notification preferences:', prefError || profileError);
        return res.status(500).json({ error: 'Failed to fetch preferences' });
      }

      const preferenceRow = prefRows?.[0];
      const preferences = preferenceRow?.preferences || notificationService.getDefaultPreferences();
      const pushChannelPreference = profileRows?.[0]?.push_channel_preference || 'auto';

      res.json({
        preferences,
        push_channel_preference: pushChannelPreference
      });

    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update notification preferences
  app.put('/api/notifications/preferences', requireAuth(), async (req, res) => {
    try {
      const { preferences, push_channel_preference } = req.body;
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validationError = validateNotificationPreferences(preferences);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      if (push_channel_preference && !['auto', 'fcm', 'apns'].includes(push_channel_preference)) {
        return res.status(400).json({ error: 'push_channel_preference must be auto, fcm, or apns' });
      }

      const timestamp = new Date().toISOString();

      const { error: preferenceError } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: userId,
            preferences,
            updated_at: timestamp
          },
          { onConflict: 'user_id' }
        );

      if (preferenceError) {
        console.error('Error updating notification preferences:', preferenceError);
        return res.status(500).json({ error: 'Failed to update preferences' });
      }

      if (push_channel_preference) {
        const { error: channelError } = await supabase
          .from('profiles')
          .update({ push_channel_preference })
          .eq('user_id', userId);

        if (channelError) {
          console.error('Error updating push channel preference:', channelError);
          return res.status(500).json({ error: 'Failed to update channel preference' });
        }
      }

      // Also update scheduled notifications if timing preferences changed
      await updateScheduledNotifications(userId, preferences);

      res.json({ success: true, preferences });

    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Client-side notification analytics events
  app.post('/api/notifications/events', requireAuth(), async (req, res) => {
    try {
      const { eventName, payload } = req.body || {};
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!eventName || typeof eventName !== 'string') {
        return res.status(400).json({ error: 'eventName is required' });
      }

      await notificationService.logEvent(userId, eventName, 'client', payload || {});

      res.json({ success: true });
    } catch (error) {
      console.error('Notification event logging failed:', error);
      res.status(500).json({ error: 'Failed to log notification event' });
    }
  });

  // Test notification endpoint
  app.post('/api/notifications/test', requireAuth(), async (req, res) => {
    try {
      const { type = 'test' } = req.body;
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await notificationService.testNotification(userId, type);

      if (result.success) {
        res.json({
          success: true,
          message: `Test notification sent successfully via ${result.channel}`,
          channel: result.channel
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.reason || result.error || 'Failed to send test notification'
        });
      }

    } catch (error) {
      console.error('Test notification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get notification history
  app.get('/api/notifications/history', requireAuth(), async (req, res) => {
    try {
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { limit = 50, offset = 0 } = req.query;

      const { data: notifications, error, count } = await supabase
        .from('notification_history')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

      if (error) {
        console.error('Error fetching notification history:', error);
        return res.status(500).json({ error: 'Failed to fetch notification history' });
      }

      res.json({
        notifications: notifications || [],
        total: count || 0
      });

    } catch (error) {
      console.error('Notification history error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mark notification as opened
  app.post('/api/notifications/ack', requireAuth(), async (req, res) => {
    try {
      const { notificationId } = req.body;
      const userId = req.auth?.userId || req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!notificationId) {
        return res.status(400).json({ error: 'Notification ID is required' });
      }

      const { error } = await supabase
        .from('notification_history')
        .update({
          opened: true,
          opened_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error acknowledging notification:', error);
        return res.status(500).json({ error: 'Failed to acknowledge notification' });
      }

      res.json({ success: true });

    } catch (error) {
      console.error('Notification acknowledgment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Timezone management endpoint
  app.put('/api/notifications/timezone', requireAuth(), async (req, res) => {
    try {
      const { timezone } = req.body;
      const userId = req.user.id;

      if (!timezone) {
        return res.status(400).json({ error: 'Timezone is required' });
      }

      // Validate timezone using moment-timezone
      if (!moment.tz.zone(timezone)) {
        return res.status(400).json({ error: 'Invalid timezone' });
      }

      const { error } = await supabase
        .from('profiles')
        .update({ timezone })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating timezone:', error);
        return res.status(500).json({ error: 'Failed to update timezone' });
      }

      console.log(`🌍 Timezone updated for user ${userId}: ${timezone}`);
      res.json({ success: true, timezone });

    } catch (error) {
      console.error('Timezone update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/internal/notifications/metrics', (req, res) => {
    if (!NOTIFICATION_METRICS_TOKEN) {
      return res.status(404).json({ error: 'Metrics endpoint not configured' });
    }

    const token = req.headers['x-notification-admin-token'];
    if (token !== NOTIFICATION_METRICS_TOKEN) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(getMetricsSnapshot());
  });

  // Get available timezones
  app.get('/api/notifications/timezones', requireAuth(), (req, res) => {
    const timezones = moment.tz.names().map(name => ({
      value: name,
      label: name.replace(/_/g, ' '),
      offset: moment.tz(name).format('Z')
    }));

    res.json({ timezones });
  });

  // Helper function to update scheduled notifications
  async function updateScheduledNotifications(userId, preferences) {
    try {
      const scheduledUpdates = [
        { key: 'daily_reminder', type: 'daily_reminder' },
        { key: 'streak_reminder', type: 'streak_reminder' },
        { key: 'weekly_reflection', type: 'weekly_reflection', supportsDay: true }
      ];

      for (const { key, type, supportsDay } of scheduledUpdates) {
        const pref = preferences[key];
        if (!pref) continue;

        const dayIndex = supportsDay && pref.day ? dayStringToIndex(pref.day) : null;
        const updatePayload = {};

        if (typeof pref.enabled === 'boolean') {
          updatePayload.enabled = pref.enabled;
        }

        const resolvedTime = pref.time || DEFAULT_SCHEDULE_TIMES[type];
        if (resolvedTime) {
          updatePayload.scheduled_time = resolvedTime;
        }

        if (supportsDay) {
          if (dayIndex != null) {
            updatePayload.days_of_week = [dayIndex];
          } else if (!pref.day) {
            updatePayload.days_of_week = [0];
          }
        } else {
          updatePayload.days_of_week = ALL_WEEK_DAYS;
        }

        const { data: existingRows, error: existingError } = await supabase
          .from('scheduled_notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', type)
          .limit(1);

        if (existingError) {
          console.error('Error checking scheduled notifications:', existingError);
          continue;
        }

        if (!existingRows || existingRows.length === 0) {
          const insertPayload = {
            user_id: userId,
            type,
            enabled: typeof pref.enabled === 'boolean' ? pref.enabled : true,
            scheduled_time: resolvedTime || DEFAULT_SCHEDULE_TIMES[type],
            days_of_week: supportsDay
              ? [dayIndex != null ? dayIndex : 0]
              : ALL_WEEK_DAYS
          };

          const { error: insertError } = await supabase
            .from('scheduled_notifications')
            .insert(insertPayload);

          if (insertError) {
            console.error('Error inserting scheduled notification:', insertError);
          }
          continue;
        }

        if (Object.keys(updatePayload).length === 0) {
          continue;
        }

        const { error: updateError } = await supabase
          .from('scheduled_notifications')
          .update(updatePayload)
          .eq('id', existingRows[0].id);

        if (updateError) {
          console.error('Error updating scheduled notifications:', updateError);
        }
      }

    } catch (error) {
      console.error('Error updating scheduled notifications:', error);
    }
  }
}
