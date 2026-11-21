importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAx0aym6Qg4_rLrFo_7WgVkOsL2mz6FpM8',
  authDomain: 'confused-14aec.firebaseapp.com',
  projectId: 'confused-14aec',
  storageBucket: 'confused-14aec.firebasestorage.app',
  messagingSenderId: '297505001916',
  appId: '1:297505001916:web:81c4bb014674be9aa0dbb9'
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Confused CSE 6CF'
  const body = payload.notification?.body || ''
  const url = payload.data?.url || '/'

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(targetUrl)
    })
  )
})
