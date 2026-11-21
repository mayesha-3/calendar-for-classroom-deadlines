import { useEffect, useState, type ReactNode } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth'
import { Calendar, CalendarClock, Settings as SettingsIcon, Menu, X, AlertTriangle, LogOut, FolderOpen } from 'lucide-react'
import type { User } from 'firebase/auth'
import ThemeToggle from './components/ThemeToggle'
import DeadlinesCalendar from './pages/DeadlinesCalendar'
import PlanningHub from './pages/PlanningHub'
import Settings from './pages/Settings'
import AdminSecurity from './pages/AdminSecurity'
import Resources from './pages/Resources'
import InstallPWA from './components/InstallPWA'
import SecurityGate from './components/SecurityGate'
import { apiFetch } from './api'
import { BACKEND_URL, isFirebaseConfigured } from './config'
import { auth, googleProvider } from './firebase'

function CalendarHub() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <DeadlinesCalendar />
      <div className="flex justify-end border-t border-[var(--border)] pt-6">
        <button type="button" onClick={() => navigate('/planning')} className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90">
          <CalendarClock size={18} /> Events Calendar
        </button>
      </div>
    </div>
  )
}

function SignIn({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>) => {
    setError('')
    setBusy(true)
    try { await action(); onAuthenticated() }
    catch (err) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = String((err as { code?: string }).code)
        if (code === 'auth/unauthorized-domain') {
          setError('Google sign-in is not enabled for this website domain. Ask the administrator to add this Vercel domain in Firebase Authentication Authorized domains.')
          return
        }
      }
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form onSubmit={(event) => { event.preventDefault(); if (auth) void run(() => register ? createUserWithEmailAndPassword(auth, email, password) : signInWithEmailAndPassword(auth, email, password)) }} className="w-full max-w-md space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-xl">
        <div><h1 className="text-2xl font-bold text-[var(--text1)]">{register ? 'Create your account' : 'Sign in to Confused CSE 6CF'}</h1><p className="mt-2 text-sm text-[var(--text2)]">Sign in with your university account to access deadlines, events, and resources.</p></div>
        <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3" /></label>
        <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">Password<input required minLength={6} type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3" /></label>
        <button disabled={busy} className="w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
        <button type="button" disabled={busy || !auth} onClick={() => auth && void run(() => signInWithPopup(auth, googleProvider))} className="w-full rounded-xl border border-[var(--border)] py-3 font-semibold text-[var(--text1)] disabled:opacity-50">Continue with Google</button>
        <button type="button" onClick={() => { setRegister(!register); setError('') }} className="w-full text-sm text-[var(--accent)]">{register ? 'Already have an account? Sign in' : 'Need an account? Create one'}</button>
        {error && <p role="alert" className="rounded-xl bg-red-500/15 p-3 text-sm text-red-500">{error}</p>}
      </form>
    </div>
  )
}

function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [gatePassed, setGatePassed] = useState(Boolean(sessionStorage.getItem('gateToken')))
  const [profile, setProfile] = useState<any>(null)
  const [profileError, setProfileError] = useState('')
  const location = useLocation()

  useEffect(() => {
    if (!auth) { setAuthReady(true); return }
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setAuthReady(true) })
  }, [])

  useEffect(() => {
    const onExpired = () => setGatePassed(false)
    window.addEventListener('kanbakan:security-gate-expired', onExpired)
    return () => window.removeEventListener('kanbakan:security-gate-expired', onExpired)
  }, [])

  useEffect(() => {
    if (!user) { setProfile(null); setProfileError(''); return }
    let cancelled = false
    apiFetch(`${BACKEND_URL}/api/auth/me`).then(async (response) => {
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not load your account.')
      return response.json()
    }).then((data) => { if (!cancelled) setProfile(data) }).catch((err) => { if (!cancelled) setProfileError(err.message) })
    return () => { cancelled = true }
  }, [user])

  if (!isFirebaseConfigured) return <SetupMessage message="Firebase is not configured. Add the VITE_FIREBASE_* values from your Firebase project to frontend/.env, then restart the frontend." />
  if (!BACKEND_URL) return <SetupMessage message="Backend is not configured. Set VITE_BACKEND_URL in frontend/.env, then restart the frontend." />
  if (!authReady) return <SetupMessage message="Connecting to your account…" />
  if (!user && !gatePassed) return <SecurityGate onPassed={() => setGatePassed(true)} />
  if (!user) return <><SignIn onAuthenticated={() => undefined} /><ThemeToggle /></>
  if (profileError) return <SetupMessage message={profileError} action={<button onClick={() => void signOut(auth!)} className="mt-4 underline">Sign out</button>} />
  if (!profile) return <SetupMessage message="Loading your account…" />

  const navItems = [
    { path: '/calendar', label: 'Calendar', icon: <Calendar size={18} /> },
    { path: '/resources', label: 'Resources', icon: <FolderOpen size={18} /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  ]

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-[var(--bg)]">
      <div className="sticky top-0 z-50 flex w-full max-w-full flex-col shadow-sm">
        <InstallPWA />
        <header className="flex h-[56px] max-w-full items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:h-[72px] sm:px-8">
          <div className="flex items-center gap-2 sm:gap-3"><button type="button" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)} className="rounded-lg p-1.5 text-[var(--text1)] hover:bg-[var(--border)]/50 md:hidden"><Menu size={20} /></button><div className="text-lg font-bold tracking-tight text-[var(--text1)] sm:text-2xl">Confused CSE 6CF</div></div>
          <nav className="hidden items-center gap-1 md:flex">{navItems.map((item) => <Link key={item.path} to={item.path} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${location.pathname === item.path || (item.path === '/calendar' && ['/','/planning'].includes(location.pathname)) || (item.path === '/settings' && location.pathname === '/settings/security') ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-[var(--text2)] hover:bg-[var(--border)]/50'}`}>{item.icon}<span>{item.label}</span></Link>)}</nav>
          <div className="flex items-center gap-2 sm:gap-5"><div className="hidden flex-col items-end sm:flex"><span className="font-semibold text-[var(--text1)]">{profile.name || profile.email || user.email}</span></div><button type="button" onClick={() => void signOut(auth!)} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text2)] hover:bg-[var(--border)]/50"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></button></div>
        </header>
        {profile.isWarned && <div className="flex w-full items-center justify-center gap-2 bg-red-600 px-3 py-2 text-center text-xs font-bold text-white sm:text-base"><AlertTriangle size={18} />Warning: You're Under Watch</div>}
      </div>
      {mobileNavOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-black/30 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[var(--surface)] p-5 shadow-2xl transition-transform duration-200 md:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="mb-8 flex items-center justify-between"><span className="text-xl font-bold text-[var(--text1)]">Navigation</span><button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-[var(--text2)]"><X size={22} /></button></div><nav className="flex flex-col gap-2">{navItems.map((item) => <Link key={item.path} to={item.path} onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[var(--text2)]">{item.icon}{item.label}</Link>)}</nav></aside>
      <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8"><Routes><Route path="/" element={<Navigate to="/calendar" replace />} /><Route path="/planning" element={<PlanningHub />} /><Route path="/calendar" element={<CalendarHub />} /><Route path="/resources" element={<Resources />} /><Route path="/settings" element={<Settings />} /><Route path="/settings/security" element={profile.role === 'admin' ? <AdminSecurity /> : <Navigate to="/settings" replace />} /><Route path="*" element={<Navigate to="/calendar" replace />} /></Routes></main>
      <footer className="flex flex-col items-center justify-center gap-5 border-t border-[var(--border)] bg-[var(--surface)] px-8 py-10"><p className="text-sm text-[var(--text2)]">&copy; {new Date().getFullYear()} Confused CSE 6CF. All rights reserved.</p></footer>
      <ThemeToggle />
    </div>
  )
}

function SetupMessage({ message, action }: { message: string; action?: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] p-6 text-center text-[var(--text1)]"><p className="max-w-xl">{message}</p>{action}<ThemeToggle /></div>
}

export default App
