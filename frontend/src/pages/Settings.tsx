import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '../firebase'
import { BACKEND_URL } from '../config'
import { apiFetch } from '../api'
import { Link } from 'react-router-dom'
import {
  Shield,
  Users,
  Activity,
  Calendar,
  CalendarDays,
  MessageSquare,
  Clock,
  Trash2,
  Check,
} from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'

interface Profile {
  _id?: string
  uid?: string
  name: string
  email: string
  username?: string
  contactEmail?: string
  role?: string
  isWarned?: boolean
}

interface AdminUser {
  _id: string
  uid?: string
  name?: string
  email: string
  contactEmail?: string
  username?: string
  role: string
  isWarned?: boolean
}

interface ActivityItem {
  type: 'deadline_created' | 'event_created' | 'comment_added'
  title: string
  user?: {
    _id?: string
    name?: string
    email?: string
    username?: string
  }
  date: string
}

function getRelativeTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return 'recently'
  const date = new Date(dateInput)
  const now = new Date()
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))

  if (diffInSeconds < 60) return 'just now'
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
  }
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
  }
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays === 1) {
    return 'yesterday'
  }
  if (diffInDays < 30) {
    return `${diffInDays} days ago`
  }
  return date.toLocaleDateString()
}

const fetchProfile = async (): Promise<Profile> => {
  const res = await apiFetch(`${BACKEND_URL}/api/profile`)
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

const updateProfile = async (data: { name: string; username: string; contactEmail: string }) => {
  const res = await apiFetch(`${BACKEND_URL}/api/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to update profile')
  }
  return res.json()
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile,
  })

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      setSuccessMsg('Profile updated successfully!')
      setErrorMsg('')
      queryClient.setQueryData(['profile'], data)
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setTimeout(() => setSuccessMsg(''), 3000)
    },
    onError: (err: any) => {
      setErrorMsg(err.message)
      setSuccessMsg('')
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    mutation.mutate({
      name: fd.get('name') as string,
      username: fd.get('username') as string,
      contactEmail: fd.get('contactEmail') as string,
    })
  }

  if (isLoading) return <div className="p-8 text-[var(--text1)]">Loading settings...</div>

  // The profile email is a backend display value; Firebase Auth is the source
  // of truth for the account's actual sign-in email.
  const firebaseEmail = auth.currentUser?.email || ''
  const displayedEmail = profile?.email || firebaseEmail
  const isInternalFallback = !firebaseEmail && displayedEmail.endsWith('@kanbankc.internal')
  const isAdmin = profile?.role === 'admin'

  return (
    <div className={`mx-auto ${isAdmin ? 'max-w-4xl' : 'max-w-xl'}`}>
      <h2 className="text-2xl font-bold text-[var(--text1)] mb-6">Account Settings</h2>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 shadow-lg">
        {/* Profile Settings Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Full Name
            <input
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              name="name"
              defaultValue={profile?.name || ''}
              required
            />
          </label>

          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Username
            <input
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              name="username"
              defaultValue={profile?.username || ''}
              placeholder="e.g. johndoe"
            />
          </label>

          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Contact Email
            <input
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              type="email"
              name="contactEmail"
              defaultValue={profile?.contactEmail || ''}
              placeholder="e.g. johndoe@company.com"
            />
            <span className="font-normal text-xs text-[var(--text2)]">Shown to other members.</span>
          </label>

          <button
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-white dark:text-midnight font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
            type="submit"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>

          {successMsg && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/15 text-red-500 font-semibold">
              {errorMsg}
            </div>
          )}
        </form>

        {/* Security & Identity */}
        <div className="mt-10 border-t border-[var(--border)] pt-6">
          <h3 className="text-[var(--text1)] font-bold mb-1">Security & Identity</h3>
          <p className="text-[var(--text2)] text-sm mb-4">
            This information is private and is used internally by the system.
          </p>
          <div className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm mb-4">
            <label>Secret UID</label>
            <input
              type="text"
              readOnly
              value={profile?.uid || ''}
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 opacity-60 cursor-not-allowed"
            />
          </div>
          <div className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm mb-4">
            <label className="flex items-center justify-between">
              <span>Firebase Email Address</span>
              {isInternalFallback && (
                <span className="text-xs text-amber-500 font-normal">Internal Placeholder</span>
              )}
            </label>
            <input
              type="text"
              readOnly
              value={displayedEmail}
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 opacity-60 cursor-not-allowed"
            />
            {isInternalFallback && (
              <p className="text-xs text-amber-500/90 font-normal">
                ⚠️ Your email address was generated as an internal system fallback. An admin can update your official email address anytime in the Admin Dashboard.
              </p>
            )}
          </div>
          <Link
            to="/settings/security"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text1)] hover:bg-[var(--border)]/50"
          >
            <Shield size={17} /> Security administration
          </Link>
        </div>

        {/* Admin Panel Section (Only visible to admins) */}
        {isAdmin && <AdminPanelSection currentProfile={profile} />}

        {/* Danger Zone */}
        <DangerZone />
      </div>
    </div>
  )
}

function AdminPanelSection({ currentProfile }: { currentProfile: Profile }) {
  const queryClient = useQueryClient()
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null)
  const [deleteError, setDeleteError] = useState('')

  // Query: Users List
  const {
    data: users = [],
    isLoading: isUsersLoading,
    error: usersError,
  } = useQuery<AdminUser[]>({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await apiFetch(`${BACKEND_URL}/api/users`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch users')
      }
      return res.json()
    },
  })

  // Query: Recent Activity
  const {
    data: activities = [],
    isLoading: isActivityLoading,
    error: activityError,
  } = useQuery<ActivityItem[]>({
    queryKey: ['recentActivity'],
    queryFn: async () => {
      const res = await apiFetch(`${BACKEND_URL}/api/users/activity/recent`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch recent activity')
      }
      return res.json()
    },
  })

  // Delete User Mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiFetch(`${BACKEND_URL}/api/users/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete user')
      }
      return res.json()
    },
    onSuccess: () => {
      setUserToDelete(null)
      setDeleteError('')
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['recentActivity'] })
    },
    onError: (err: any) => {
      setDeleteError(err.message || 'Failed to delete user')
    },
  })

  return (
    <div className="mt-10 border-t border-[var(--border)] pt-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
            <Shield size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--text1)]">Admin Control Panel</h3>
            <p className="text-xs text-[var(--text2)] mt-0.5">
              Manage system users and monitor recent platform activities
            </p>
          </div>
        </div>
      </div>

      {deleteError && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-500 text-xs font-semibold flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            type="button"
            onClick={() => setDeleteError('')}
            className="text-red-500 underline ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Part A: Users List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-[var(--text1)] flex items-center gap-2">
            <Users size={18} className="text-[var(--accent)]" /> Platform Users ({users.length})
          </h4>
        </div>

        {usersError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {(usersError as Error).message || 'Failed to load users'}
          </div>
        )}

        {isUsersLoading ? (
          <div className="p-6 text-center text-sm text-[var(--text2)] border border-[var(--border)] rounded-xl bg-[var(--bg)]">
            Loading platform users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text2)] border border-[var(--border)] rounded-xl bg-[var(--bg)]">
            No users registered.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {users.map((user) => {
              const isSelf =
                user._id === currentProfile._id ||
                user.uid === currentProfile.uid ||
                (user.email &&
                  currentProfile.email &&
                  user.email.toLowerCase() === currentProfile.email.toLowerCase())

              return (
                <UserAdminCard
                  key={user._id}
                  user={user}
                  isSelf={Boolean(isSelf)}
                  onDelete={(u) => {
                    setDeleteError('')
                    setUserToDelete(u)
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Part B: Recent Activity (past 3 days) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-[var(--text1)] flex items-center gap-2">
            <Activity size={18} className="text-[var(--accent)]" /> Recent Activity (Past 3 Days)
          </h4>
        </div>

        {activityError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {(activityError as Error).message || 'Failed to load recent activity'}
          </div>
        )}

        {isActivityLoading ? (
          <div className="p-6 text-center text-sm text-[var(--text2)] border border-[var(--border)] rounded-xl bg-[var(--bg)]">
            Loading recent activity...
          </div>
        ) : activities.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text2)] border border-dashed border-[var(--border)] rounded-xl bg-[var(--bg)]">
            No activity recorded in the past 3 days.
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((item, idx) => (
              <ActivityRow key={`${item.type}-${item.date}-${idx}`} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Confirm Dialog for User Deletion */}
      <ConfirmDialog
        open={Boolean(userToDelete)}
        title="Delete User"
        message={`Are you sure you want to permanently delete "${userToDelete?.name || userToDelete?.email}"? This action cannot be undone and will purge all their created content.`}
        confirmText={deleteMutation.isPending ? 'Deleting...' : 'Delete User'}
        cancelText="Cancel"
        destructive={true}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setUserToDelete(null)
          }
        }}
        onConfirm={() => {
          if (userToDelete) {
            deleteMutation.mutate(userToDelete._id)
          }
        }}
      />
    </div>
  )
}

function UserAdminCard({
  user,
  isSelf,
  onDelete,
}: {
  user: AdminUser
  isSelf: boolean
  onDelete: (user: AdminUser) => void
}) {
  const queryClient = useQueryClient()
  const [usernameDraft, setUsernameDraft] = useState(user.username || '')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setUsernameDraft(user.username || '')
  }, [user.username])

  const usernameMutation = useMutation({
    mutationFn: async (newUsername: string) => {
      const res = await apiFetch(`${BACKEND_URL}/api/users/${user._id}/username`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update username')
      }
      return res.json()
    },
    onSuccess: (updatedUser) => {
      setFeedback({ type: 'success', text: 'Username updated!' })
      queryClient.setQueryData<AdminUser[]>(['adminUsers'], (old) => {
        if (!old) return old
        return old.map((u) => (u._id === user._id ? { ...u, username: updatedUser.username } : u))
      })
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setTimeout(() => setFeedback(null), 3000)
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', text: err.message || 'Update failed' })
      setTimeout(() => setFeedback(null), 4000)
    },
  })

  const hasChanged = usernameDraft.trim() !== (user.username || '')

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasChanged || !usernameDraft.trim() || usernameMutation.isPending) return
    usernameMutation.mutate(usernameDraft.trim())
  }

  return (
    <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-[var(--accent)]/40 transition-all">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-[var(--text1)] truncate">
                {user.name || 'Unnamed User'}
              </span>
              {isSelf && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                  You
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text2)] truncate mt-0.5" title={user.email}>
              {user.email}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                user.role === 'admin'
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                  : 'bg-[var(--surface)] text-[var(--text2)] border border-[var(--border)]'
              }`}
            >
              {user.role || 'user'}
            </span>

            {!isSelf && (
              <button
                type="button"
                onClick={() => onDelete(user)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 cursor-pointer"
                title={`Delete user ${user.name || user.email}`}
                aria-label={`Delete user ${user.name || user.email}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--border)]/60">
        <label className="text-[11px] font-semibold text-[var(--text2)] block mb-1">
          Username
        </label>
        <form onSubmit={handleSaveUsername} className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text2)] font-medium">
              @
            </span>
            <input
              type="text"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value)}
              placeholder="e.g. johndoe"
              className="w-full text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text1)] pl-6 pr-2.5 py-1.5 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!hasChanged || !usernameDraft.trim() || usernameMutation.isPending}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Check size={12} />
            {usernameMutation.isPending ? '...' : 'Save'}
          </button>
        </form>

        {feedback && (
          <p
            className={`text-[11px] mt-1.5 font-medium ${
              feedback.type === 'success' ? 'text-emerald-500' : 'text-red-500'
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>
    </div>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const relativeTime = getRelativeTime(item.date)
  const userName = item.user?.name || item.user?.username || item.user?.email || 'Unknown User'

  let badgeColor = 'bg-gray-500/15 text-gray-400 border-gray-500/20'
  let typeLabel = 'Activity'
  let IconComponent = Clock

  if (item.type === 'deadline_created') {
    badgeColor = 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30'
    typeLabel = 'Deadline Created'
    IconComponent = Calendar
  } else if (item.type === 'event_created') {
    badgeColor = 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
    typeLabel = 'Event Created'
    IconComponent = CalendarDays
  } else if (item.type === 'comment_added') {
    badgeColor = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    typeLabel = 'Comment Added'
    IconComponent = MessageSquare
  }

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] transition-all hover:border-[var(--accent)]/30">
      <div className={`p-2 rounded-lg shrink-0 border ${badgeColor}`}>
        <IconComponent size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeColor}`}
            >
              {typeLabel}
            </span>
            <span className="text-xs font-semibold text-[var(--text1)] truncate">
              {userName}
            </span>
          </div>
          <span className="text-xs text-[var(--text2)] font-medium shrink-0 flex items-center gap-1">
            <Clock size={12} className="opacity-70" />
            {relativeTime}
          </span>
        </div>

        <p className="text-sm font-medium text-[var(--text1)] mt-1.5 break-words">
          {item.title || '(No content)'}
        </p>
      </div>
    </div>
  )
}

function DangerZone() {
  const [isModalOpen, setModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDeleteSelf = async () => {
    setIsDeleting(true)
    setError('')
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/profile`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete account')
      }
      if (auth) {
        await auth.signOut()
      }
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message)
      setIsDeleting(false)
    }
  }

  return (
    <div className="mt-10 border-t border-red-500/30 pt-6">
      <h3 className="text-red-500 font-bold text-base flex items-center gap-2">
        Danger Zone
      </h3>
      <p className="text-[var(--text2)] text-sm mt-1 mb-4">
        Once you delete your account, your access will be permanently revoked.
        This action cannot be undone.
      </p>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 font-semibold hover:bg-red-500/20 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
      >
        Delete My Account
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-red-500">
              Confirm Account Deletion
            </h3>
            <p className="text-sm text-[var(--text2)] leading-relaxed">
              Are you sure you want to delete your account? You will lose access
              to Confused CSE 6CF immediately.
            </p>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 text-red-500 text-xs font-semibold">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-[var(--text1)] hover:bg-[var(--bg)] rounded-xl border border-[var(--border)] text-sm font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelf}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
