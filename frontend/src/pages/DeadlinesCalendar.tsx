import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '../firebase'
import { Send, ChevronLeft, ChevronRight, Plus, X, Trash2 } from 'lucide-react'
import { BACKEND_URL } from '../config'
import { apiFetch } from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import ParticleOverlay from '../components/ParticleOverlay'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DEADLINE_TYPE_OPTIONS = [
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'project_proposal', label: 'Project Proposal' },
  { value: 'lab_exam', label: 'Lab Exam' },
  { value: 'mid', label: 'Mid' },
  { value: 'ct', label: 'CT' },
  { value: 'final_exam', label: 'Final Exam' },
  { value: 'other', label: 'Other' },
]

const MAX_CHIPS_PER_DAY = 3

const fetchDeadlines = async () => {
  const res = await apiFetch(`${BACKEND_URL}/api/deadlines`)
  if (!res.ok) throw new Error('Failed to fetch deadlines')
  return res.json()
}

const fetchComments = async (deadlineId: string) => {
  const res = await apiFetch(`${BACKEND_URL}/api/deadlines/${deadlineId}/comments`)
  if (!res.ok) throw new Error('Failed to fetch comments')
  return res.json()
}

const postComment = async ({ deadlineId, content }: { deadlineId: string; content: string }) => {
  const res = await apiFetch(`${BACKEND_URL}/api/deadlines/${deadlineId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error('Failed to post comment')
  return res.json()
}

const createDeadline = async (data: { title: string; description: string; type: string; customType?: string; deadline: string }) => {
  const res = await apiFetch(`${BACKEND_URL}/api/deadlines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create deadline')
  }
  return res.json()
}

export default function DeadlinesCalendar() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDeadline, setSelectedDeadline] = useState<any>(null)
  const [commentText, setCommentText] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState('lab_report')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<any>(null)

  const { data: deadlines = [], isLoading } = useQuery({
    queryKey: ['deadlines'],
    queryFn: fetchDeadlines,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['deadlineComments', selectedDeadline?._id],
    queryFn: () => fetchComments(selectedDeadline._id),
    enabled: !!selectedDeadline,
    refetchInterval: 5000,
  })

  const commentMutation = useMutation({
    mutationFn: postComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlineComments', selectedDeadline?._id] })
      setCommentText('')
    },
  })

  const createMutation = useMutation({
    mutationFn: createDeadline,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      setShowCreateModal(false)
      setCreateType('lab_report')
    },
    onError: (err: any) => alert(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`${BACKEND_URL}/api/deadlines/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      setSelectedDeadline(null)
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async ({ deadlineId, commentId }: { deadlineId: string; commentId: string }) => {
      const res = await apiFetch(`${BACKEND_URL}/api/deadlines/${deadlineId}/comments/${commentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete comment')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlineComments', selectedDeadline?._id] })
      setDeleteCommentTarget(null)
    },
  })

  // Build date -> deadlines lookup
  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, any[]>()
    deadlines.forEach((dl: any) => {
      if (!dl.deadline) return
      const key = dl.deadline.split('T')[0]
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(dl)
    })
    return map
  }, [deadlines])

  // Calendar grid cells
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startDayOfWeek = firstDay.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
    const cells: { day: number; month: number; year: number; outside: boolean }[] = []

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day: d, month: m, year: y, outside: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, outside: false })
    }
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, month: m, year: y, outside: true })
    }
    return cells
  }, [viewYear, viewMonth])

  // Upcoming deadlines (next 14 days)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() + 14)
    return deadlines
      .filter((dl: any) => {
        if (!dl.deadline) return false
        const d = new Date(dl.deadline)
        return d >= now && d <= cutoff
      })
      .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 10)
  }, [deadlines])

  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  const goToNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }
  const goToToday = () => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()) }

  const isToday = (cell: typeof calendarCells[0]) =>
    cell.day === today.getDate() && cell.month === today.getMonth() && cell.year === today.getFullYear()

  const getDateKey = (cell: typeof calendarCells[0]) => {
    const mm = String(cell.month + 1).padStart(2, '0')
    const dd = String(cell.day).padStart(2, '0')
    return `${cell.year}-${mm}-${dd}`
  }

  const getTypeLabel = (dl: any) => {
    if (dl.type === 'other') return dl.customType || 'Other'
    return DEADLINE_TYPE_OPTIONS.find(o => o.value === dl.type)?.label || dl.type
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'lab_report': return 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-l-violet-500'
      case 'presentation': return 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-l-sky-500'
      case 'project_proposal': return 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border-l-teal-500'
      case 'lab_exam': return 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-l-rose-500'
      case 'mid': return 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-l-orange-500'
      case 'ct': return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-l-amber-500'
      case 'final_exam': return 'bg-red-500/15 text-red-600 dark:text-red-300 border-l-red-500'
      default: return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-l-blue-500'
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'lab_report': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20'
      case 'presentation': return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20'
      case 'project_proposal': return 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/20'
      case 'lab_exam': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
      case 'mid': return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20'
      case 'ct': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
      case 'final_exam': return 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
      default: return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
    }
  }

  const getDaysLeftInfo = (deadlineDate: string) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const due = new Date(deadlineDate)
    due.setHours(0, 0, 0, 0)
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-500 font-bold' }
    if (diff === 0) return { text: 'Today', cls: 'text-orange-500 font-bold' }
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-orange-500 font-bold' }
    if (diff <= 3) return { text: `${diff} days left`, cls: 'text-orange-500 font-medium' }
    return { text: `${diff} days left`, cls: 'text-[var(--text2)]' }
  }

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createMutation.mutate({
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      type: fd.get('type') as string,
      customType: fd.get('customType') as string || undefined,
      deadline: fd.get('deadline') as string,
    })
  }

  if (isLoading) return <div className="p-8 text-[var(--text2)]">Loading Calendar...</div>

  return (
    <div className="flex flex-col h-full min-h-0 gap-6 p-6">
      <ParticleOverlay />
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text1)]">Deadlines Calendar</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            onClick={goToPrev} title="Previous month">
            <ChevronLeft size={18} />
          </button>
          <span className="text-base sm:text-xl font-bold text-[var(--text1)] min-w-[140px] sm:min-w-[220px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            onClick={goToNext} title="Next month">
            <ChevronRight size={18} />
          </button>
          <button
            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 text-sm font-semibold hover:bg-[var(--accent)]/20 transition-all"
            onClick={goToToday}>Today</button>
          <button
            className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-all cursor-pointer"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} /> Add New
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden min-h-[300px] sm:min-h-[400px]">
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="py-2 sm:py-3 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--text2)]">{d}</div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-[minmax(60px,1fr)] sm:auto-rows-[minmax(100px,1fr)] bg-[var(--surface)]">
          {calendarCells.map((cell, idx) => {
            const key = getDateKey(cell)
            const dayDeadlines = deadlinesByDate.get(key) || []
            const visible = dayDeadlines.slice(0, MAX_CHIPS_PER_DAY)
            const overflow = dayDeadlines.length - MAX_CHIPS_PER_DAY

            return (
              <div
                key={idx}
                className={`relative border-r border-b border-[var(--border)]/30 p-2 flex flex-col transition-colors hover:bg-[var(--text2)]/5
                  ${cell.outside ? 'opacity-30 pointer-events-none' : ''}
                  ${isToday(cell) ? 'bg-[var(--accent)]/5 ring-1 ring-inset ring-[var(--accent)]/20' : ''}`}>
                <span className={`text-sm font-semibold mb-2 ${isToday(cell) ? 'text-[var(--accent)]' : 'text-[var(--text1)]'}`}>
                  {cell.day}
                </span>
                <div className="flex flex-col gap-1 overflow-y-auto pr-1">
                  {visible.map((dl: any) => (
                    <div
                      key={dl._id}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium cursor-pointer border-l-2 transition-all hover:translate-x-0.5 truncate ${getTypeColor(dl.type)}`}
                      onClick={() => { setSelectedDeadline(dl); setCommentText('') }}
                      title={`${dl.title} — ${getTypeLabel(dl)}`}>
                      <span className="truncate">{dl.title}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] font-semibold text-[var(--text2)] mt-1 px-1 bg-[var(--text2)]/10 rounded w-fit">
                      +{overflow} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming Deadlines Strip */}
      {upcomingDeadlines.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {upcomingDeadlines.map((dl: any) => {
            const info = getDaysLeftInfo(dl.deadline)
            return (
              <div
                key={dl._id}
                className="flex-none w-[220px] p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl cursor-pointer hover:-translate-y-0.5 hover:border-[var(--accent)] transition-all flex flex-col gap-2"
                onClick={() => { setSelectedDeadline(dl); setCommentText('') }}>
                <h4 className="text-[var(--text1)] font-semibold truncate" title={dl.title}>{dl.title}</h4>
                <div className="flex items-center justify-between text-xs mt-auto">
                  <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${getTypeBadgeColor(dl.type)}`}>
                    {getTypeLabel(dl)}
                  </span>
                  <span className={info.cls}>{info.text}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete deadline?"
        message={`Are you sure you want to delete "${deleteTarget?.title || 'this deadline'}"? This cannot be undone.`}
        confirmText="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget._id)
            setDeleteTarget(null)
          }
        }}
      />

      {/* Create Deadline Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[var(--text1)]">Add New Deadline</h3>
              <button className="text-[var(--text2)] hover:text-[var(--text1)] transition-colors cursor-pointer" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Title
                <input name="title" required className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Description
                <textarea name="description" rows={3} placeholder="Details..." className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 resize-none focus:outline-none focus:border-[var(--accent)] transition-colors" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Type
                <select name="type" value={createType} onChange={e => setCreateType(e.target.value)} className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer">
                  {DEADLINE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              {createType === 'other' && (
                <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                  Custom Type Name
                  <input name="customType" required placeholder="e.g. Quiz, Assignment..." className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors" />
                </label>
              )}
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Deadline
                <input type="date" name="deadline" required className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer" />
              </label>
              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)] font-medium hover:text-[var(--text1)] transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer">
                  {createMutation.isPending ? 'Creating...' : 'Create Deadline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deadline Details + Comments Modal */}
      {selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedDeadline(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[var(--border)]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <h3 className="text-xl font-bold text-[var(--text1)]">Deadline Details</h3>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 text-[var(--text2)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all cursor-pointer"
                  title="Delete deadline"
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(selectedDeadline) }}>
                  <Trash2 size={16} />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text2)] hover:bg-[var(--text2)]/10 hover:text-[var(--text1)] transition-colors" onClick={() => setSelectedDeadline(null)}>
                  &times;
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Details */}
              <div className="flex-1 overflow-y-auto p-6 border-b md:border-b-0 md:border-r border-[var(--border)] space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Title</label>
                  <p className="text-[var(--text1)] font-medium text-lg mt-1">{selectedDeadline.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Type</label>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getTypeBadgeColor(selectedDeadline.type)}`}>
                        {getTypeLabel(selectedDeadline)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Deadline</label>
                    <p className="mt-1 text-[var(--text1)]">
                      {selectedDeadline.deadline ? new Date(selectedDeadline.deadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'None'}
                    </p>
                  </div>
                </div>

                {selectedDeadline.createdBy && (
                  <div>
                    <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Created By</label>
                    <p className="mt-1 text-[var(--text1)] text-sm">
                      {selectedDeadline.createdBy.username ? `@${selectedDeadline.createdBy.username}` : selectedDeadline.createdBy.name || selectedDeadline.createdBy.email}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Description</label>
                  <div className="mt-1 p-3 bg-[var(--bg)] rounded-lg text-sm text-[var(--text1)] whitespace-pre-wrap border border-[var(--border)]">
                    {selectedDeadline.description || <em className="text-[var(--text2)]">No details provided.</em>}
                  </div>
                </div>

                {(() => {
                  const info = getDaysLeftInfo(selectedDeadline.deadline)
                  return (
                    <div className={`text-center py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] font-semibold text-sm ${info.cls}`}>
                      {info.text === 'Today' ? '⏰ This deadline is today!' :
                       info.text === 'Tomorrow' ? '📅 This deadline is tomorrow!' :
                       info.text.includes('overdue') ? `🚨 ${info.text}` :
                       `📅 ${info.text}`}
                    </div>
                  )
                })()}
              </div>

              {/* Comments */}
              <div className="flex-1 flex flex-col w-full md:w-80 lg:w-96 bg-[var(--surface)]">
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)]/50">
                  <h4 className="font-semibold text-[var(--text1)]">Comments</h4>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-[var(--text2)] italic text-center mt-4">No comments yet.</p>
                  ) : (
                    comments.map((comment: any) => (
                      <div key={comment._id} className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
                        <div className="flex justify-between items-center mb-1">
                          <strong className="text-sm font-semibold text-[var(--text1)]">
                            {comment.author?.username ? `@${comment.author.username}` : comment.author?.name || comment.author?.email}
                          </strong>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text2)]">
                              {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDeleteCommentTarget(comment)}
                              className="p-1 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                              title="Delete comment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-[var(--text1)] whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <form
                  className="p-4 border-t border-[var(--border)] flex gap-2 bg-[var(--surface)]"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!commentText.trim()) return
                    commentMutation.mutate({ deadlineId: selectedDeadline._id, content: commentText })
                  }}>
                  <input
                    type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                    placeholder="Type a comment..."
                    disabled={commentMutation.isPending}
                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--text1)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text2)] disabled:opacity-50"
                  />
                  <button type="submit" disabled={commentMutation.isPending || !commentText.trim()} className="w-10 h-10 flex items-center justify-center bg-[var(--accent)] text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Comment Confirm Dialog */}
      <ConfirmDialog
        open={!!deleteCommentTarget}
        title="Delete Comment"
        message={`Are you sure you want to delete this comment?`}
        confirmText={deleteCommentMutation.isPending ? 'Deleting...' : 'Delete'}
        cancelText="Cancel"
        destructive
        onClose={() => { if (!deleteCommentMutation.isPending) setDeleteCommentTarget(null) }}
        onConfirm={() => {
          if (deleteCommentTarget && selectedDeadline) {
            deleteCommentMutation.mutate({ deadlineId: selectedDeadline._id, commentId: deleteCommentTarget._id })
          }
        }}
      />
    </div>
  )
}
