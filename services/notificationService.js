import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import http2 from 'http2';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import moment from 'moment-timezone';
import config from '../config/notifications.js';
import { logInfo, logError, logWarn, createLogContext } from '../server/observability/logger.js';
import { recordDelivery, updateSchedulerLag, updateRetryQueueDepth } from '../server/observability/metrics.js';

const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  enabled: true,
  daily_reminder: { enabled: true, time: '20:00' },
  streak_reminder: { enabled: true, time: '21:00' },
  meditation_ready: { enabled: true },
  weekly_reflection: { enabled: true, day: 'sunday', time: '19:00' },
  replay_radio: { enabled: false, time: '07:00' },
  achievements: { enabled: true }
});

const RETRY_BACKOFF_MS = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  2 * 60 * 60 * 1000
];

const MAX_RETRY_ATTEMPTS = 5;
const NOTIFICATION_HISTORY_RETENTION_DAYS = 90;

class NotificationService {
  constructor() {
    this.fcmApp = null;
    this.apnsKey = null;
    this.apnsConfig = null;
    this.initialized = false;
  }

  getDefaultPreferences() {
    return JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES));
  }

  /**
   * Create Supabase client (overridable for tests)
   */
  getSupabaseClient() {
    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        const serviceAccount = {
          type: "service_account",
          project_id: config.firebase.projectId,
          private_key_id: config.firebase.privateKeyId,
          private_key: config.firebase.privateKey,
          client_email: config.firebase.clientEmail,
          client_id: config.firebase.clientId,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${config.firebase.clientEmail}`
        };

        this.fcmApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: config.firebase.projectId
        });
      } else {
        this.fcmApp = admin.apps[0];
      }

      // Initialize APNs configuration for HTTP/2 with JWT
      if (config.apns.teamId && config.apns.keyId) {
        try {
          // Try to get key from environment variable first, then fall back to file
          if (config.apns.keyContent) {
            this.apnsKey = config.apns.keyContent;
          } else if (config.apns.keyPath) {
            // Fallback to file reading for local development
            this.apnsKey = fs.readFileSync(config.apns.keyPath, 'utf8');
          } else {
            throw new Error('No APNs key source available (neither APNS_KEY nor APPLE_PRIVATE_KEY_PATH)');
          }

          this.apnsConfig = {
            teamId: config.apns.teamId,
            keyId: config.apns.keyId,
            bundleId: config.apns.bundleId,
            production: config.apns.production
          };
          console.log('APNs HTTP/2 configuration loaded successfully');
        } catch (error) {
          console.error('Failed to load APNs key:', error);
          this.apnsKey = null;
          this.apnsConfig = null;
        }
      }

      this.initialized = true;
      console.log('Notification service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      throw error;
    }
  }

  async logEvent(userId, eventName, eventSource, payload = {}) {
    if (!userId || !eventName) {
      return;
    }

    try {
      const supabase = this.getSupabaseClient();
      await supabase
        .from('notification_events')
        .insert({
          user_id: userId,
          event_name: eventName,
          event_source: eventSource,
          payload
        });
    } catch (error) {
      logWarn('notification.event.log_failed', {
        userId,
        eventName,
        reason: error.message
      });
    }
  }

  /**
   * Fetch profile, preferences, and devices for a user in a single helper
   */
  async fetchUserNotificationContext(userId) {
    try {
      const supabase = this.getSupabaseClient();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, push_channel_preference, timezone, name')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        }
        return { profile: null, preferences: null, devices: [] };
      }

      const [preferencesResult, devicesResult] = await Promise.all([
        supabase
          .from('notification_preferences')
          .select('preferences')
          .eq('user_id', userId)
          .limit(1),
        supabase
          .from('notification_devices')
          .select('id, token, push_provider, platform, timezone, app_version, device_id, device_name, language, last_registered_at, updated_at, created_at')
          .eq('user_id', userId)
      ]);

      if (preferencesResult.error) {
        console.error('Error fetching notification preferences:', preferencesResult.error);
      }

      if (devicesResult.error) {
        console.error('Error fetching notification devices:', devicesResult.error);
      }

      const preferences = preferencesResult.data?.[0]?.preferences
        ? JSON.parse(JSON.stringify(preferencesResult.data[0].preferences))
        : this.getDefaultPreferences();

      const devices = devicesResult.data ? [...devicesResult.data] : [];

      return { profile, preferences, devices };
    } catch (error) {
      console.error('Error in fetchUserNotificationContext:', error);
      return { profile: null, preferences: null, devices: [] };
    }
  }

  /**
   * Compose notification message using templates
   */
  composeMessage(type, data = {}) {
    const template = config.messageTemplates[type];
    if (!template) {
      return {
        title: 'Replay Notification',
        body: 'You have a new notification.',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      };
    }

    return {
      title: template.title,
      body: typeof template.getBody === 'function' ? template.getBody(data.param) : template.body,
      icon: template.icon,
      badge: template.badge,
      sound: template.sound
    };
  }

  /**
   * Determine if notification type is enabled for user preferences
   */
  isNotificationEnabled(preferences, type) {
    if (!preferences || typeof preferences !== 'object') {
      return false;
    }

    if (preferences.enabled === false) {
      return false;
    }

    const typePreferences = preferences[type];
    if (!typePreferences || typePreferences.enabled === false) {
      return false;
    }

    return true;
  }

  /**
   * Normalize and validate push token
   */
  normalizeToken(token, channel) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token format');
    }

    // Trim whitespace
    token = token.trim();

    // Basic validation
    if (channel === 'fcm' && token.length < 50) {
      throw new Error('FCM token appears to be too short');
    }

    if (channel === 'apns' && token.length < 20) {
      throw new Error('APNs token appears to be too short');
    }

    return token;
  }

  /**
   * Send notification with exponential backoff retry
   */
  async sendWithRetry(sendFunction, maxAttempts = config.retry.maxAttempts) {
    let lastError;
    let delay = config.retry.initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await sendFunction();
        return { success: true, attempt, result };
      } catch (error) {
        lastError = error;
        console.error(`Notification attempt ${attempt}/${maxAttempts} failed:`, error.message);

        if (attempt < maxAttempts) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * config.retry.backoffFactor, config.retry.maxDelay);
        }
      }
    }

    return { success: false, attempts: maxAttempts, error: lastError.message };
  }

  /**
   * Determine the best channel for a user based on preferences and available tokens
   */
  determineChannel(user, devices = []) {
    const deviceList = Array.isArray(devices)
      ? devices.filter((device) => device && device.token)
      : [];

    if (!deviceList.length) {
      return { channel: null, device: null };
    }

    const sortByRecency = (a, b) => {
      const aDate = new Date(a.last_registered_at || a.updated_at || a.created_at || 0);
      const bDate = new Date(b.last_registered_at || b.updated_at || b.created_at || 0);
      return bDate - aDate;
    };

    const findLatest = (provider) => {
      const matches = deviceList.filter((device) => device.push_provider === provider);
      if (!matches.length) return null;
      return matches.sort(sortByRecency)[0];
    };

    const apnsDevice = findLatest('apns');
    const fcmDevice = findLatest('fcm');

    if (user.push_channel_preference === 'apns' && apnsDevice) {
      return { channel: 'apns', device: apnsDevice };
    }

    if (user.push_channel_preference === 'fcm' && fcmDevice) {
      return { channel: 'fcm', device: fcmDevice };
    }

    const platformName = (device) => (device?.platform || '').toLowerCase();

    if (user.push_channel_preference === 'auto' || !user.push_channel_preference) {
      if (apnsDevice && ['safari', 'ios', 'apple'].includes(platformName(apnsDevice))) {
        return { channel: 'apns', device: apnsDevice };
      }
      if (fcmDevice) {
        return { channel: 'fcm', device: fcmDevice };
      }
      if (apnsDevice) {
        return { channel: 'apns', device: apnsDevice };
      }
    }

    if (fcmDevice) {
      return { channel: 'fcm', device: fcmDevice };
    }

    if (apnsDevice) {
      return { channel: 'apns', device: apnsDevice };
    }

    return { channel: null, device: null };
  }

  /**
   * Check if user has exceeded rate limits
   */
  async checkRateLimit(userId, notificationType) {
    try {
      if (config.rateLimits.disabled) {
        return { exceeded: false };
      }

      const supabase = this.getSupabaseClient();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const maxDaily = Number.isFinite(config.rateLimits.maxNotificationsPerUserPerDay)
        ? config.rateLimits.maxNotificationsPerUserPerDay
        : 10;
      const maxPerType = Number.isFinite(config.rateLimits.maxNotificationsPerType)
        ? config.rateLimits.maxNotificationsPerType
        : 1;
      const cooldown = Number.isFinite(config.rateLimits.cooldownPeriod)
        ? config.rateLimits.cooldownPeriod
        : 3600000;

      // Check daily rate limit
      const { count: dailyCount } = await supabase
        .from('notification_history')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('sent_at', today.toISOString());

      if (dailyCount >= maxDaily) {
        return { exceeded: true, reason: 'daily_limit_exceeded' };
      }

      // Check per-type rate limit (prevent spam of same notification type)
      const oneHourAgo = new Date(Date.now() - cooldown);
      const { count: typeCount } = await supabase
        .from('notification_history')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', notificationType)
        .gte('sent_at', oneHourAgo.toISOString());

      if (typeCount >= maxPerType) {
        return { exceeded: true, reason: 'type_cooldown' };
      }

      return { exceeded: false };

    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { exceeded: false }; // Allow notification on error
    }
  }

  /**
   * Send a push notification using the appropriate channel
   */
  async sendPushNotification(userId, notification, context = null, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const { disableRetry = false, origin = 'primary' } = options;
    const logContext = createLogContext({
      userId,
      notificationType: notification?.type,
      origin
    });

    let channelUsed = 'unknown';
    let contextData = null;
    let selectedDevice = null;
    const startTime = Date.now();

    logInfo('notification.delivery.attempt', logContext);

    try {
      const rateCheck = await this.checkRateLimit(userId, notification.type);
      if (rateCheck.exceeded) {
        logWarn('notification.delivery.rate_limited', {
          ...logContext,
          reason: rateCheck.reason
        });
        await this.logEvent(userId, 'notification_rate_limited', 'server', {
          type: notification.type,
          reason: rateCheck.reason
        });
        return { success: false, reason: rateCheck.reason };
      }

      contextData = context || await this.fetchUserNotificationContext(userId);

      if (!contextData.profile) {
        const error = new Error(`User not found: ${userId}`);
        error.code = 'user_not_found';
        throw error;
      }

      const effectivePreferences = contextData.preferences || {};
      if (!this.isNotificationEnabled(effectivePreferences, notification.type)) {
        logInfo('notification.delivery.suppressed', {
          ...logContext,
          reason: 'notifications_disabled'
        });
        return { success: false, reason: 'notifications_disabled' };
      }

      const { channel, device } = this.determineChannel(contextData.profile, contextData.devices);

      if (!channel || !device) {
        const error = new Error(`No valid notification channel for user ${userId}`);
        error.code = 'no_channel';
        throw error;
      }

      channelUsed = channel;
      selectedDevice = device;

      let result;
      if (channel === 'fcm') {
        result = await this.sendFCMNotification(device.token, notification);
      } else if (channel === 'apns') {
        result = await this.sendAppleWebPushNotification(device.token, notification);
      }

      recordDelivery({
        channel,
        type: notification.type,
        status: 'success',
        durationSeconds: (Date.now() - startTime) / 1000
      });

      await this.logNotificationHistory(userId, notification, channel, result.success);
      await this.logEvent(userId, 'notification_delivery_success', 'server', {
        channel,
        type: notification.type,
        origin
      });

      logInfo('notification.delivery.success', {
        ...logContext,
        channel
      });

      return { success: true, channel, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error?.code || (typeof error?.errorInfo?.code === 'string' ? error.errorInfo.code : 'unknown');

      const lowerMessage = errorMessage.toLowerCase();
      const isUnregisteredToken = lowerMessage.includes('requested entity was not found') || errorCode === 'messaging/registration-token-not-registered';

      recordDelivery({
        channel: channelUsed || 'unknown',
        type: notification.type,
        status: 'failed',
        durationSeconds: (Date.now() - startTime) / 1000
      });

      await this.logNotificationHistory(userId, notification, channelUsed, false, errorMessage);
      await this.logEvent(userId, 'notification_delivery_failure', 'server', {
        channel: channelUsed,
        type: notification.type,
        origin,
        error: errorMessage,
        errorCode
      });

      logError('notification.delivery.failed', {
        ...logContext,
        channel: channelUsed,
        error: errorMessage,
        errorCode
      });

      if (isUnregisteredToken && channelUsed && selectedDevice?.token) {
        try {
          const supabase = this.getSupabaseClient();
          await supabase
            .from('notification_devices')
            .delete()
            .eq('token', selectedDevice.token);
          logInfo('notification.tokens.pruned', {
            userId,
            channel: channelUsed,
            reason: 'token_unregistered'
          });
        } catch (pruneError) {
          logWarn('notification.tokens.prune_failed', {
            userId,
            channel: channelUsed,
            error: pruneError instanceof Error ? pruneError.message : String(pruneError)
          });
        }
      }

      const retryable = !disableRetry &&
        !lowerMessage.includes('notifications disabled') &&
        !lowerMessage.includes('no valid notification channel') &&
        !isUnregisteredToken;

      if (retryable) {
        await this.enqueueRetry(userId, notification, errorMessage, errorCode);
      }

      return { success: false, error: errorMessage, reason: errorCode };
    }
  }

  /**
   * Send FCM notification with retry logic
   */
  async sendFCMNotification(token, notification) {
    const makeFCMData = (data = {}) => {
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        result[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
      return result;
    };

    const dataPayload = makeFCMData({
      ...notification.data,
      url: notification.data?.url || '/',
      notificationType: notification.type,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/badge-72x72.png'
    });

    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: dataPayload,
      webpush: {
        notification: {
          icon: notification.icon || '/icon-192x192.png',
          badge: notification.badge || '/badge-72x72.png'
        },
        fcm_options: {
          link: notification.data?.url || '/'
        }
      }
    };

    // Use retry logic for FCM sending
    const result = await this.sendWithRetry(async () => {
      const response = await admin.messaging().send(message);
      logInfo('notification.fcm.sent', {
        messageId: response
      });
      return { messageId: response };
    });

    if (result.success) {
      return { success: true, ...result.result };
    } else {
      throw new Error(`FCM send failed after ${result.attempts} attempts: ${result.error}`);
    }
  }

  /**
   * Send Apple Web Push notification
   */
  /**
   * Generate APNs JWT token for authentication
   */
  generateApnsJWT() {
    if (!this.apnsKey || !this.apnsConfig) {
      throw new Error('APNs configuration not available');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.apnsConfig.teamId,
      iat: now,
      exp: now + 3600 // Token expires in 1 hour
    };

    const header = {
      alg: 'ES256',
      kid: this.apnsConfig.keyId
    };

    return jwt.sign(payload, this.apnsKey, {
      algorithm: 'ES256',
      header: header
    });
  }

  /**
   * Send APNs notification via HTTP/2 with JWT authentication
   */
  async sendAppleWebPushNotification(deviceToken, notification) {
    if (!this.apnsKey || !this.apnsConfig) {
      throw new Error('APNs configuration not initialized');
    }

    try {
      // Generate JWT token for authentication
      const jwtToken = this.generateApnsJWT();

      // Build APNs payload for Safari Web Push
      const payload = {
        aps: {
          alert: {
            title: notification.title,
            body: notification.body
          },
          badge: 1,
          sound: notification.sound || 'default',
          'url-args': [notification.data?.url || '/']
        },
        // Custom data
        data: {
          notificationType: notification.type,
          ...notification.data
        }
      };

      // Add action buttons if specified
      if (notification.actions) {
        payload.aps.category = 'ACTION_CATEGORY';
        payload.actions = notification.actions;
      }

      const payloadJson = JSON.stringify(payload);

      // APNs server URL
      const hostname = this.apnsConfig.production
        ? 'api.push.apple.com'
        : 'api.sandbox.push.apple.com';

      const path = `/3/device/${deviceToken}`;

      return new Promise((resolve, reject) => {
        const client = http2.connect(`https://${hostname}`);

        client.on('error', (clientError) => {
          logError('notification.apns.client_error', {
            error: clientError.message
          });
          client.close();
          reject(clientError);
        });

        const headers = {
          ':method': 'POST',
          ':path': path,
          'authorization': `bearer ${jwtToken}`,
          'apns-id': uuidv4(),
          'apns-expiration': Math.floor(Date.now() / 1000) + 86400, // 24 hours
          'apns-priority': '10',
          'apns-topic': this.apnsConfig.bundleId,
          'content-type': 'application/json'
        };

        const req = client.request(headers);

        let responseData = '';
        let statusCode = 0;

        req.setEncoding('utf8');

        req.on('response', (headers) => {
          statusCode = headers[':status'] || 0;
        });

        req.on('data', (chunk) => {
          responseData += chunk;
        });

        req.on('end', () => {
          client.close();

          if (statusCode === 200) {
            logInfo('notification.apns.sent');
            resolve({ success: true, statusCode });
          } else {
            let errorReason = 'Unknown error';
            try {
              errorReason = responseData ? JSON.parse(responseData).reason : errorReason;
            } catch (parseError) {
              logWarn('notification.apns.parse_error', {
                error: parseError.message
              });
            }
            reject(new Error(`APNs delivery failed: ${errorReason} (${statusCode})`));
          }
        });

        req.on('error', (error) => {
          logError('notification.apns.request_error', {
            error: error.message
          });
          client.close();
          reject(error);
        });

        req.write(payloadJson);
        req.end();
      });

    } catch (error) {
      logError('notification.apns.failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Log notification to history table
   */
  async logNotificationHistory(userId, notification, channel, delivered, error = null) {
    try {
        const supabase = this.getSupabaseClient();

      await supabase
        .from('notification_history')
        .insert({
          user_id: userId,
          type: notification.type,
          channel: channel,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          delivered: delivered,
          error: error
        });
    } catch (logError) {
      console.error('Failed to log notification history:', logError);
    }
  }

  async enqueueRetry(userId, notification, lastError, errorCode = 'unknown', attempts = 0) {
    try {
      const supabase = this.getSupabaseClient();
      const backoffIndex = Math.min(attempts, RETRY_BACKOFF_MS.length - 1);
      const scheduledAt = new Date(Date.now() + RETRY_BACKOFF_MS[backoffIndex]).toISOString();

      await supabase
        .from('notification_retry_queue')
        .insert({
          user_id: userId,
          notification,
          last_error: lastError,
          attempts,
          max_attempts: MAX_RETRY_ATTEMPTS,
          scheduled_at: scheduledAt
        });

      const { count } = await supabase
        .from('notification_retry_queue')
        .select('id', { count: 'exact', head: true });

      updateRetryQueueDepth(count || 0);

      logInfo('notification.retry.enqueued', {
        userId,
        notificationType: notification?.type,
        attempts,
        scheduledAt,
        errorCode
      });

      await this.logEvent(userId, 'notification_retry_enqueued', 'server', {
        attempts,
        scheduledAt,
        type: notification?.type,
        error: lastError,
        errorCode
      });

    } catch (error) {
      logWarn('notification.retry.enqueue_failed', {
        userId,
        notificationType: notification?.type,
        reason: error.message
      });
    }
  }

  async processRetryQueue(limit = 10) {
    try {
      const supabase = this.getSupabaseClient();
      const nowIso = new Date().toISOString();

      const { count: totalCount } = await supabase
        .from('notification_retry_queue')
        .select('id', { count: 'exact', head: true });

      updateRetryQueueDepth(totalCount || 0);

      const { data: jobs, error } = await supabase
        .from('notification_retry_queue')
        .select('*')
        .lte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      if (!jobs || jobs.length === 0) {
        return;
      }

      logInfo('notification.retry.batch_start', { jobs: jobs.length });

      for (const job of jobs) {
        const jobContext = createLogContext({
          queueId: job.id,
          userId: job.user_id,
          notificationType: job.notification?.type,
          attempts: job.attempts
        });

        try {
          const context = await this.fetchUserNotificationContext(job.user_id);
          const result = await this.sendPushNotification(
            job.user_id,
            job.notification,
            context,
            { disableRetry: true, origin: 'retry' }
          );

          if (result.success) {
            await supabase
              .from('notification_retry_queue')
              .delete()
              .eq('id', job.id);

            logInfo('notification.retry.delivered', jobContext);
            await this.logEvent(job.user_id, 'notification_retry_delivered', 'server', {
              attempts: job.attempts,
              channel: result.channel,
              type: job.notification?.type
            });
          } else {
            const nextAttempts = job.attempts + 1;
            const failureReason = result.error || 'unknown';

            if (nextAttempts >= (job.max_attempts || MAX_RETRY_ATTEMPTS)) {
              await supabase
                .from('notification_retry_queue')
                .delete()
                .eq('id', job.id);

              logWarn('notification.retry.exhausted', {
                ...jobContext,
                reason: failureReason
              });

              await this.logEvent(job.user_id, 'notification_retry_exhausted', 'server', {
                attempts: nextAttempts,
                error: failureReason,
                type: job.notification?.type
              });
            } else {
              const backoffIndex = Math.min(nextAttempts, RETRY_BACKOFF_MS.length - 1);
              const scheduledAt = new Date(Date.now() + RETRY_BACKOFF_MS[backoffIndex]).toISOString();

              await supabase
                .from('notification_retry_queue')
                .update({
                  attempts: nextAttempts,
                  last_error: failureReason,
                  scheduled_at: scheduledAt
                })
                .eq('id', job.id);

              logInfo('notification.retry.rescheduled', {
                ...jobContext,
                nextAttempts,
                scheduledAt,
                reason: failureReason
              });

              await this.logEvent(job.user_id, 'notification_retry_rescheduled', 'server', {
                attempts: nextAttempts,
                scheduledAt,
                error: failureReason,
                type: job.notification?.type
              });
            }
          }
        } catch (jobError) {
          logError('notification.retry.processing_failed', {
            ...jobContext,
            error: jobError instanceof Error ? jobError.message : jobError
          });
        }
      }

      const { count: remaining } = await supabase
        .from('notification_retry_queue')
        .select('id', { count: 'exact', head: true });

      updateRetryQueueDepth(remaining || 0);
    } catch (error) {
      logError('notification.retry.queue_failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send scheduled notifications (to be called by cron job)
   */
  async sendScheduledNotifications() {
    if (!this.initialized) {
      await this.initialize();
    }

    const supabase = this.getSupabaseClient();

    try {
      const { data: scheduledNotifications, error } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .eq('enabled', true);

      if (error) {
        logError('notification.scheduled.load_failed', {
          error: error.message
        });
        return;
      }

      if (!scheduledNotifications?.length) {
        logInfo('notification.scheduled.empty');
        return;
      }

      logInfo('notification.scheduled.batch_start', {
        count: scheduledNotifications.length
      });

      const contextCache = new Map();

      for (const scheduled of scheduledNotifications) {
        if (!scheduled.user_id) {
          continue;
        }

        let context = contextCache.get(scheduled.user_id);
        if (!context) {
          context = await this.fetchUserNotificationContext(scheduled.user_id);
          contextCache.set(scheduled.user_id, context);
        }

        if (!context.profile) {
          continue;
        }

        if (!this.isNotificationEnabled(context.preferences, scheduled.type)) {
          continue;
        }

        const userTimezone = context.profile.timezone || config.defaultTimezone;

        const evaluation = this.shouldSendScheduledNotification(scheduled, userTimezone);
        if (!evaluation.shouldSend) {
          continue;
        }

        const { userNow, userCurrentTime, lagSeconds } = evaluation;

        if (typeof lagSeconds === 'number') {
          updateSchedulerLag(lagSeconds);
        }

        logInfo('notification.scheduled.dispatch', {
          userId: context.profile.user_id,
          type: scheduled.type,
          timezone: userTimezone,
          currentTime: userCurrentTime,
          lagSeconds
        });

        let notificationContent;
        switch (scheduled.type) {
          case 'daily_reminder':
            notificationContent = await this.getDailyReminderContent(context.profile);
            break;
          case 'streak_reminder':
            notificationContent = await this.getStreakReminderContent(context.profile);
            break;
          case 'weekly_reflection':
            notificationContent = await this.getWeeklyReflectionContent(context.profile);
            break;
          default:
            continue;
        }

        if (notificationContent) {
          const result = await this.sendPushNotification(context.profile.user_id, notificationContent, context);

          // Update last_sent timestamp
          await supabase
            .from('scheduled_notifications')
            .update({ last_sent: userNow ? userNow.toISOString() : new Date().toISOString() })
            .eq('id', scheduled.id);

          await this.logEvent(context.profile.user_id, 'scheduled_notification_sent', 'server', {
            type: scheduled.type,
            channel: result?.channel,
            timezone: userTimezone,
            lagSeconds
          });
        }
      }
    } catch (error) {
      logError('notification.scheduled.failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Evaluate whether a scheduled notification should fire for the current moment
   */
  shouldSendScheduledNotification(scheduled, userTimezone, referenceTime = moment()) {
    try {
      const baseMoment = moment.isMoment(referenceTime)
        ? referenceTime.clone()
        : moment(referenceTime);

      const userNow = baseMoment.clone().tz(userTimezone);
      const userCurrentTime = userNow.format('HH:mm');
      const userCurrentDay = userNow.day();

      const scheduledDays = scheduled.days_of_week || [];
      if (!scheduledDays.includes(userCurrentDay)) {
        return { shouldSend: false };
      }

      const [scheduledHour, scheduledMinute] = (scheduled.scheduled_time || '00:00').split(':').map(Number);
      const scheduledMoment = userNow.clone().set({
        hour: Number.isFinite(scheduledHour) ? scheduledHour : 0,
        minute: Number.isFinite(scheduledMinute) ? scheduledMinute : 0,
        second: 0,
        millisecond: 0
      });

      const timeDiffMinutes = userNow.diff(scheduledMoment, 'minutes');

      if (timeDiffMinutes < 0 || timeDiffMinutes > 5) {
        return { shouldSend: false };
      }

      if (scheduled.last_sent) {
        const lastSentInUserTz = moment.tz(scheduled.last_sent, userTimezone).format('YYYY-MM-DD');
        const todayInUserTz = userNow.format('YYYY-MM-DD');
        if (lastSentInUserTz === todayInUserTz) {
          return { shouldSend: false };
        }
      }

      return {
        shouldSend: true,
        userNow,
        userCurrentTime,
        scheduledMoment,
        lagSeconds: Math.max(0, userNow.diff(scheduledMoment, 'seconds'))
      };
    } catch (error) {
      console.error('Error evaluating scheduled notification timing:', error);
      return { shouldSend: false };
    }
  }


  /**
   * Get user profile with full data for scheduled notifications
   */
  async getUserProfile(userId) {
    const context = await this.fetchUserNotificationContext(userId);
    if (!context.profile) {
      return null;
    }
    return {
      ...context.profile,
      notification_preferences: context.preferences,
      devices: context.devices
    };
  }

  /**
   * Get daily reminder notification content
   */
  async getDailyReminderContent(user) {
    const supabase = this.getSupabaseClient();

    // Check if user already recorded something today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayNotes } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', user.user_id)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`);

    if (todayNotes?.length > 0) {
      return null; // User already recorded something today
    }

    return {
      type: 'daily_reminder',
      title: 'Capture today\'s moments',
      body: 'Don\'t forget to capture today\'s experiences and reflections.',
      data: {
        url: '/experiences?action=record'
      }
    };
  }

  /**
   * Get streak reminder notification content
   */
  async getStreakReminderContent(user) {
    const supabase = this.getSupabaseClient();

    // Check if user meditated today
    const today = new Date().toISOString().split('T')[0];
    const { data: todayMeditations } = await supabase
      .from('meditation_completions')
      .select('id')
      .eq('user_id', user.user_id)
      .gte('completed_at', `${today}T00:00:00Z`)
      .lt('completed_at', `${today}T23:59:59Z`);

    if (todayMeditations?.length > 0) {
      return null; // User already meditated today
    }

    // Check if user has notes today to reflect on
    const { data: todayNotes } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', user.user_id)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`);

    if (!todayNotes?.length) {
      return null; // No notes to reflect on
    }

    return {
      type: 'streak_reminder',
      title: 'Make sense of your day',
      body: 'You have new experiences to reflect on. Create your meditation?',
      data: {
        url: '/reflections'
      }
    };
  }

  /**
   * Get weekly reflection notification content
   */
  async getWeeklyReflectionContent(user) {
    const supabase = this.getSupabaseClient();

    // Get this week's notes count
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { data: weekNotes, count } = await supabase
      .from('notes')
      .select('id', { count: 'exact' })
      .eq('user_id', user.user_id)
      .gte('created_at', weekStart.toISOString());

    if (!count || count === 0) {
      return null; // No notes this week
    }

    return {
      type: 'weekly_reflection',
      title: 'Weekly Reflection',
      body: `You captured ${count} experiences this week. Create your weekly reflection?`,
      data: {
        url: '/reflections?period=week'
      }
    };
  }

  /**
   * Send inactivity re-engagement notifications
   */
  async sendInactivityReminders() {
    try {
      const supabase = this.getSupabaseClient();

      const now = new Date();

      const threeDaysAgo = new Date(now.getTime() - config.inactivity.firstReminder);
      const twoWeeksAgo = new Date(now.getTime() - config.inactivity.stopAfter);

      const { data: deviceUsers, error: devicesError } = await supabase
        .from('notification_devices')
        .select('user_id')
        .not('token', 'is', null);

      if (devicesError) {
        logError('notification.inactivity.fetch_devices_failed', {
          error: devicesError.message
        });
        return;
      }

      const uniqueUserIds = Array.from(new Set((deviceUsers || []).map((device) => device.user_id).filter(Boolean)));

      if (!uniqueUserIds.length) {
        logInfo('notification.inactivity.no_devices');
        return;
      }

      logInfo('notification.inactivity.batch_start', {
        users: uniqueUserIds.length
      });

      for (const userId of uniqueUserIds) {
        const context = await this.fetchUserNotificationContext(userId);
        if (!context.profile || !context.preferences?.enabled || !(context.devices?.length)) {
          continue;
        }

        const { data: lastActivityRows, error: activityError } = await supabase
          .from('notes')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (activityError) {
          logError('notification.inactivity.fetch_activity_failed', {
            userId,
            error: activityError.message
          });
          continue;
        }

        const lastActivityIso = lastActivityRows?.[0]?.created_at;
        if (!lastActivityIso) {
          continue;
        }

        const lastActivity = new Date(lastActivityIso);
        const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

        if (lastActivity >= threeDaysAgo || lastActivity <= twoWeeksAgo) {
          continue;
        }

        // Compose message based on inactivity duration
        const message = this.composeMessage('inactivity_reengagement', { param: daysSinceActivity });

        await this.sendPushNotification(userId, {
          type: 'inactivity_reengagement',
          title: message.title,
          body: message.body,
          data: {
            url: '/experiences',
            daysSinceActivity
          }
        }, context);

        logInfo('notification.inactivity.sent', {
          userId,
          daysSinceActivity
        });
      }

    } catch (error) {
      logError('notification.inactivity.failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Test notification delivery
   */
  async testNotification(userId, notificationType = 'test') {
    const message = this.composeMessage(notificationType);

    const testNotification = {
      type: notificationType,
      title: message.title,
      body: message.body,
      data: {
        url: '/',
        test: true
      }
    };

    return await this.sendPushNotification(userId, testNotification);
  }

  /**
   * Clean up expired and invalid tokens (run as background job)
   */
  async cleanupExpiredTokens() {
    try {
      const supabase = this.getSupabaseClient();

      // Find tokens older than 90 days (expired)
      const expiryCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const { data: devices, error } = await supabase
        .from('notification_devices')
        .select('id, last_registered_at, updated_at, created_at');

      if (error) {
        console.error('Error fetching notification devices for cleanup:', error);
        return;
      }

      const expiredDeviceIds = (devices || [])
        .filter((device) => {
          const candidate = device.last_registered_at || device.updated_at || device.created_at;
          if (!candidate) return false;
          return new Date(candidate) < expiryCutoff;
        })
        .map((device) => device.id);

      if (!expiredDeviceIds.length) {
        logInfo('notification.cleanup.no_expired_devices');
        return;
      }

      logInfo('notification.cleanup.expired_devices_found', {
        count: expiredDeviceIds.length
      });

      const { error: cleanupError } = await supabase
        .from('notification_devices')
        .delete()
        .in('id', expiredDeviceIds);

      if (cleanupError) {
        console.error('Error cleaning up expired tokens:', cleanupError);
        return;
      }

      logInfo('notification.cleanup.expired_devices_pruned', {
        count: expiredDeviceIds.length
      });

    } catch (error) {
      logError('notification.cleanup.failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async pruneNotificationHistory() {
    try {
      const supabase = this.getSupabaseClient();
      const cutoff = new Date(Date.now() - NOTIFICATION_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000)
        .toISOString();

      await supabase
        .from('notification_history')
        .delete()
        .lt('sent_at', cutoff);

      await supabase
        .from('notification_events')
        .delete()
        .lt('created_at', cutoff);

      logInfo('notification.history.pruned', {
        cutoff
      });
    } catch (error) {
      logError('notification.history.prune_failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Validate and test token health
   */
  async validateToken(userId, channel) {
    try {
      const supabase = this.getSupabaseClient();

      const { data: devices, error } = await supabase
        .from('notification_devices')
        .select('token, last_registered_at, updated_at, created_at')
        .eq('user_id', userId)
        .eq('push_provider', channel);

      if (error) {
        return { valid: false, reason: 'Lookup error', error: error.message };
      }

      if (!devices?.length) {
        return { valid: false, reason: 'No token found' };
      }

      devices.sort((a, b) => {
        const aDate = new Date(a.last_registered_at || a.updated_at || a.created_at || 0);
        const bDate = new Date(b.last_registered_at || b.updated_at || b.created_at || 0);
        return bDate - aDate;
      });

      const latest = devices[0];
      const token = latest.token;

      if (!token) {
        return { valid: false, reason: 'No token found' };
      }

      if (channel === 'fcm' && token.length < 50) {
        return { valid: false, reason: 'FCM token too short' };
      }

      if (channel === 'apns' && token.length < 20) {
        return { valid: false, reason: 'APNs token too short' };
      }

      const lastUpdated = latest.last_registered_at || latest.updated_at || latest.created_at;

      if (lastUpdated) {
        const lastUpdatedDate = new Date(lastUpdated);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        if (lastUpdatedDate < thirtyDaysAgo) {
          return { valid: false, reason: 'Token expired (>30 days old)', needsRefresh: true };
        }
      }

      return { valid: true, token, lastUpdated };

    } catch (error) {
      console.error('Token validation error:', error);
      return { valid: false, reason: 'Validation error', error: error.message };
    }
  }
}

export default new NotificationService();
