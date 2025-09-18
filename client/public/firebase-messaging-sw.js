// Firebase Service Worker for background message handling
// Version: 2024.12.0
const SW_VERSION = '2024.12.0';

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// The config is expected to be provided via /firebase-sw-config.js at runtime.
// That file should assign an object to self.__REPLAY_FIREBASE_CONFIG and must
// never be committed with real credentials.
try {
  importScripts('/firebase-sw-config.js');
} catch (error) {
  console.error('Failed to load Firebase messaging config for service worker', error);
}

const firebaseConfig = self.__REPLAY_FIREBASE_CONFIG;

if (!firebaseConfig) {
  console.error('[Replay] Firebase messaging config missing in service worker.');
} else {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  // Handle background messages from FCM
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Received FCM background message:', payload);

    const { title, body, icon, badge, data } = payload.notification || payload.data || {};

    if (!title) {
      console.error('[SW] No title in notification payload');
      return;
    }

    const notificationOptions = {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: badge || '/badge-72x72.png',
      data: {
        ...data,
        channel: 'fcm',
        url: data?.url || '/',
        notificationId: data?.notificationId || null
      },
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      requireInteraction: false,
      vibrate: [200, 100, 200]
    };

    self.registration.showNotification(title, notificationOptions);
  });
}

// Handle raw push events (for APNs Web Push)
self.addEventListener('push', (event) => {
  console.log('[SW] Received push event');

  if (!event.data) {
    console.error('[SW] No data in push event');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[SW] Push payload:', payload);

    // Check if this is already handled by FCM
    if (payload.from) {
      console.log('[SW] FCM message, skipping push handler');
      return;
    }

    const { title, body, icon, badge, actions, url, sound, notificationId } = payload;

    if (!title) {
      console.error('[SW] No title in push payload');
      return;
    }

    const notificationOptions = {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: badge || '/badge-72x72.png',
      actions: actions || [
        { action: 'open', title: 'Open' },
        { action: 'mark-read', title: 'Mark as Read' }
      ],
      data: {
        url: url || '/',
        channel: 'apns',
        notificationId: notificationId || null
      },
      sound: sound || 'default',
      requireInteraction: false,
      vibrate: [200, 100, 200]
    };

    event.waitUntil(
      self.registration.showNotification(title, notificationOptions)
    );
  } catch (error) {
    console.error('[SW] Error handling push event:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  event.notification.close();

  // Handle mark as read action
  if (event.action === 'mark-read' || event.action === 'dismiss') {
    if (event.notification.data?.notificationId) {
      event.waitUntil(
        fetch('/api/notifications/ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notificationId: event.notification.data.notificationId,
            action: event.action
          })
        }).catch(err => console.error('[SW] Failed to ack notification:', err))
      );
    }
    return;
  }

  // Handle deep linking
  const urlToOpen = new URL(
    event.notification.data?.url || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // Check if app is already open
      for (let client of windowClients) {
        // If we find an open window, focus it and navigate
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            // Post message to the client to handle navigation
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: event.notification.data?.url || '/',
              channel: event.notification.data?.channel || 'unknown',
              notificationId: event.notification.data?.notificationId || null
            });
          });
        }
      }

      // No open windows, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Service worker lifecycle events
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${SW_VERSION}`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${SW_VERSION}`);
  event.waitUntil(clients.claim());

  // Broadcast version update to all clients
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'SW_VERSION_UPDATE',
          version: SW_VERSION
        });
      });
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  console.log('[SW] Received message from client:', event.data);

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: SW_VERSION });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested by client');
    self.skipWaiting();
  }
});
