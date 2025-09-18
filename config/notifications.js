// Centralized notification service configuration

const notificationConfig = {
  // Service Configuration
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/New_York',

  // Firebase/FCM Configuration
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientId: process.env.FIREBASE_CLIENT_ID,
    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID
  },

  // Apple Push Notification Configuration
  apns: {
    keyId: process.env.APPLE_KEY_ID,
    teamId: process.env.APPLE_TEAM_ID,
    keyPath: process.env.APPLE_PRIVATE_KEY_PATH,
    bundleId: process.env.APPLE_WEB_PUSH_ID || 'web.com.replay.app',
    webPushId: process.env.APPLE_WEB_PUSH_ID || 'web.com.replay.app',
    production: process.env.NODE_ENV === 'production'
  },

  // Retry Policies
  retry: {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000,    // 10 seconds
    backoffFactor: 2    // Exponential backoff
  },

  // Rate Limits
  rateLimits: {
    disabled: process.env.DISABLE_NOTIFICATION_RATE_LIMIT === 'true',
    maxNotificationsPerUserPerDay: parseInt(process.env.NOTIFICATION_MAX_PER_DAY ?? '10', 10),
    maxNotificationsPerType: parseInt(process.env.NOTIFICATION_MAX_PER_TYPE ?? '1', 10),
    cooldownPeriod: parseInt(process.env.NOTIFICATION_COOLDOWN_MS ?? '3600000', 10) // milliseconds
  },

  // Scheduled Job Configuration
  scheduler: {
    cronExpression: '*/5 * * * *', // Every 5 minutes
    tokenCleanupCron: '0 2 * * *', // Daily at 2 AM
    inactivityCheckCron: '0 10 * * *' // Daily at 10 AM
  },

  // Notification Message Templates
  messageTemplates: {
    meditation_ready: {
      title: 'Your Meditation is Ready!',
      getBody: (type) => {
        const typeMap = {
          'Day': 'Your daily meditation is ready to listen.',
          'Night': 'Your evening reflection is ready to listen.',
          'Ideas': 'Your insights meditation is ready to listen.',
          'radio': 'Your personalized talk show is ready to listen.'
        };
        return typeMap[type] || 'Your meditation is ready to listen.';
      },
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      sound: 'default'
    },

    daily_reminder: {
      title: 'Capture Today\'s Moments',
      body: 'Don\'t forget to record your thoughts and experiences from today.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    },

    streak_reminder: {
      title: 'Continue Your Journey',
      body: 'You have experiences to reflect on. Create your meditation?',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    },

    weekly_reflection: {
      title: 'Weekly Reflection',
      getBody: (count) => `You captured ${count} experiences this week. Create your weekly reflection?`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    },

    inactivity_reengagement: {
      title: 'We Miss You!',
      getBody: (daysSince) => {
        if (daysSince <= 3) return 'Ready to continue your reflection journey?';
        if (daysSince <= 7) return 'Your mindful practice is waiting for you.';
        return 'Take a moment to reconnect with yourself.';
      },
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    },

    test: {
      title: 'Test Notification',
      body: 'This is a test notification from Replay.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    }
  },

  // Inactivity Thresholds
  inactivity: {
    firstReminder: 3 * 24 * 60 * 60 * 1000,  // 3 days
    secondReminder: 7 * 24 * 60 * 60 * 1000, // 7 days
    stopAfter: 14 * 24 * 60 * 60 * 1000      // 14 days - stop sending
  }
};

export default notificationConfig;
