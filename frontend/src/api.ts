import { auth } from './firebase'
import { BACKEND_URL } from './config'

export const SECURITY_GATE_EXPIRED_EVENT = 'kanbakan:security-gate-expired'

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (!BACKEND_URL) throw new Error('Backend is not configured. Set VITE_BACKEND_URL in frontend/.env.')

  const url = input instanceof Request ? input.url : String(input)
  const target = /^https?:\/\//i.test(url) ? url : `${BACKEND_URL}${url.startsWith('/') ? '' : '/'}${url}`
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  new Headers(init.headers).forEach((value, key) => headers.set(key, value))

  if (auth?.currentUser) {
    headers.set('Authorization', `Bearer ${await auth.currentUser.getIdToken()}`)
  } else {
    const gateToken = sessionStorage.getItem('gateToken')
    if (gateToken) headers.set('x-gate-token', gateToken)
  }

  const response = await fetch(target, { ...init, headers })
  if (response.status === 403 && !auth?.currentUser) {
    sessionStorage.removeItem('gateToken')
    window.dispatchEvent(new Event(SECURITY_GATE_EXPIRED_EVENT))
  }
  return response
}
