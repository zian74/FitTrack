/* Service worker FitTrack — network-first pour les fichiers de l'app, repli cache hors ligne */
const CACHE = 'fittrack-v37';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== REMIND_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ---------- Rappels de re-test (notifications) ----------
// La page envoie les groupes dus via postMessage ; le PeriodicSync les lit depuis
// ce cache pour notifier même quand l'app est fermée (Android/desktop).
const REMIND_CACHE = CACHE + '-reminders';
let remindersData = { due: [], enabled: false };

self.addEventListener('message', e => {
  const msg = e.data || {};
  if (msg.type === 'reminders-data') {
    remindersData = { due: msg.due || [], enabled: !!msg.enabled };
    e.waitUntil(
      caches.open(REMIND_CACHE).then(c =>
        c.put('./__reminders__.json', new Response(JSON.stringify(remindersData), {
          headers: { 'Content-Type': 'application/json' }
        }))
      )
    );
  }
});

async function loadReminders() {
  try {
    const cache = await caches.open(REMIND_CACHE);
    const res = await cache.match('./__reminders__.json');
    if (res) remindersData = await res.json();
  } catch { /* garde les données en mémoire */ }
  return remindersData;
}

function showReminder(due) {
  if (!due.length) return;
  return self.registration.showNotification('FitTrack — tests à refaire 🔔', {
    body: `${due.length} groupe${due.length > 1 ? 's' : ''} : ${due.join(', ')}`,
    icon: './icon-192.png',
    tag: 'fittrack-reminder',
  });
}

// PeriodicSync : déclenché par le navigateur (Android Chrome, ~1×/jour quand l'app est installée)
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'fittrack-reminder') return;
  e.waitUntil(
    loadReminders().then(d => {
      if (d.enabled) showReminder(d.due);
    })
  );
});

// Clic sur la notification : ouvre (ou focus) l'app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('./index.html'))
      )
  );
});
