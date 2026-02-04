// SW KILL SWITCH - Self Unregistering
self.addEventListener('install', () => {
  self.skipWaiting();
  console.log('SW Kill Switch: Installing...');
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister()
      .then(() => {
        console.log('SW Kill Switch: Successfully unregistered self.');
        return self.clients.matchAll();
      })
      .then(clients => {
        clients.forEach(client => client.navigate(client.url));
      })
  );
});

// Fallback: Just let everything through to the network
self.addEventListener('fetch', (event) => {
  return;
});
