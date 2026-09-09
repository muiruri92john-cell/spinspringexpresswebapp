// CuePay Service Worker v1.0
const CACHE_NAME = 'cuepay-cache-v1.0';
const STATIC_ASSETS = [
  '/',
  '/cuepay/login',
  '/cuepay/dashboard',
  '/css/style.css',
  '/js/main.js',
  '/favicon.svg',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('CuePay Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('CuePay Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => {
          return name !== CACHE_NAME;
        }).map((name) => {
          console.log('Deleting old cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, then network
self.addEventListener('fetch', (event) => {
  // Skip API calls and sync endpoints
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/sync') ||
      event.request.url.includes('/command') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached response immediately
          // Fetch updated version in background
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          }).catch(() => {});
          
          return cachedResponse;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clonedResponse = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clonedResponse);
            });
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // Offline fallback - show custom offline page
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  let data = {
    title: 'CuePay Alert',
    body: 'New update from your pool table',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'cuepay-alert',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View Dashboard' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch(e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      vibrate: data.vibrate,
      tag: data.tag,
      requireInteraction: data.requireInteraction,
      actions: data.actions
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    const urlToOpen = '/cuepay/dashboard';
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        // Check if there is already a window open
        for (const client of windowClients) {
          if (client.url.includes('/cuepay') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});