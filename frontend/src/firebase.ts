import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getMessaging, type Messaging } from 'firebase/messaging'
import { FIREBASE_CONFIG, isFirebaseConfigured } from './config'

const firebaseApp = isFirebaseConfigured
  ? getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG)
  : null

export const auth = (firebaseApp ? getAuth(firebaseApp) : null) as Auth
export const googleProvider = new GoogleAuthProvider()
export const messaging = (firebaseApp && typeof window !== 'undefined' && 'Notification' in window
  ? getMessaging(firebaseApp)
  : null) as Messaging
