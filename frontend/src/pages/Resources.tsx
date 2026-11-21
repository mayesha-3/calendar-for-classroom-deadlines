import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api'
import { BACKEND_URL } from '../config'
import { Download, FileText, Folder, FolderPlus, LoaderCircle, Trash2, Upload, X } from 'lucide-react'
import type { FormEvent } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

type ResourceItem = {
  _id: string
  name: string
  kind: 'folder' | 'pdf'
  parentId: string | null
  ownerId?: { _id: string; uid?: string; name?: string; email?: string } | string
  size?: number
  createdAt: string
}

const request = async (path: string, init?: RequestInit) => {
  const response = await apiFetch(`${BACKEND_URL}/api/resources${path}`, init)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Resource request failed.')
  }
  return response
}

const formatSize = (bytes = 0) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

export default function Resources() {
  const [parentId, setParentId] = useState<string | null>(null)
  const [trail, setTrail] = useState<Array<{ id: string; name: string }>>([])
  const [items, setItems] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [folderName, setFolderName] = useState('')
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ResourceItem | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const loadItems = async () => {
    setLoading(true)
    setError('')
    try {
      const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''
      setItems(await (await request(query)).json())
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load resources.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void loadItems() }, [parentId])

  const createFolder = async (event: FormEvent) => {
    event.preventDefault()
    const name = folderName.trim()
    if (!name) return
    setBusy(true)
    try {
      await request('/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) })
      setFolderName('')
      setShowFolderForm(false)
      await loadItems()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create folder.') }
    finally { setBusy(false) }
  }

  const uploadPdf = async (file?: File) => {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { setError('Choose a PDF file.'); return }
    if (file.size > 25 * 1024 * 1024) { setError('PDFs must be 25 MB or smaller.'); return }
    setBusy(true)
    setError('')
    try {
      const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : ''
      await request(`/upload${query}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) }, body: file })
      await loadItems()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not upload PDF.') }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = '' }
  }

  const downloadPdf = async (item: ResourceItem) => {
    setBusy(true)
    setError('')
    try {
      const response = await request(`/${encodeURIComponent(item._id)}/file`)
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = item.name
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not download PDF.') }
    finally { setBusy(false) }
  }

  const confirmDeleteItem = async () => {
    if (!deleteTarget) return
    setBusy(true)
    setError('')
    try { await request(`/${encodeURIComponent(deleteTarget._id)}`, { method: 'DELETE' }); await loadItems() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete resource.') }
    finally { setBusy(false); setDeleteTarget(null) }
  }

  const openFolder = (item: ResourceItem) => {
    setTrail((current) => [...current, { id: item._id, name: item.name }])
    setParentId(item._id)
  }

  const goTo = (index: number) => {
    setTrail((current) => current.slice(0, index))
    setParentId(index === 0 ? null : trail[index - 1].id)
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-3xl font-bold text-[var(--text1)]">Resources</h1><p className="mt-1 text-[var(--text2)]">Organize shared folders and PDF documents.</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setShowFolderForm(true); setError('') }} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 font-semibold text-[var(--text1)] hover:bg-[var(--border)]/40"><FolderPlus size={18} />New folder</button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 font-semibold text-white disabled:opacity-50"><Upload size={18} />Upload PDF</button>
          <input ref={fileInput} className="hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => void uploadPdf(event.target.files?.[0])} />
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-5 py-4 text-sm">
          <button type="button" onClick={() => goTo(0)} className="font-semibold text-[var(--accent)]">Resources</button>
          {trail.map((folder, index) => <span key={folder.id} className="flex items-center gap-2 text-[var(--text2)]"><span>/</span><button type="button" onClick={() => goTo(index + 1)} className={index === trail.length - 1 ? 'font-semibold text-[var(--text1)]' : 'hover:text-[var(--accent)]'}>{folder.name}</button></span>)}
        </div>

        {showFolderForm && <form onSubmit={createFolder} className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row"><input autoFocus maxLength={180} required placeholder="Folder name" value={folderName} onChange={(event) => setFolderName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-2.5 text-[var(--text1)]" /><button disabled={busy} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 font-semibold text-white">Create folder</button><button type="button" onClick={() => setShowFolderForm(false)} aria-label="Cancel" className="rounded-xl border border-[var(--border)] p-2.5 text-[var(--text2)]"><X size={18} /></button></form>}

        {error && <div role="alert" className="m-4 rounded-xl bg-red-500/10 p-3 text-sm font-medium text-red-500">{error}</div>}
        {loading ? <div className="flex items-center justify-center gap-2 p-12 text-[var(--text2)]"><LoaderCircle className="animate-spin" size={18} />Loading resources…</div> : items.length === 0 ? <div className="p-12 text-center"><Folder size={32} className="mx-auto mb-3 text-[var(--text2)]" /><p className="font-semibold text-[var(--text1)]">This folder is empty</p><p className="mt-1 text-sm text-[var(--text2)]">Create a folder or upload a PDF to get started.</p></div> : <div className="divide-y divide-[var(--border)]">{items.map((item) => <div key={item._id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><div className="rounded-xl bg-[var(--bg)] p-2.5 text-[var(--accent)]">{item.kind === 'folder' ? <Folder size={20} /> : <FileText size={20} />}</div><div className="min-w-0 flex-1">{item.kind === 'folder' ? <button type="button" onClick={() => openFolder(item)} className="truncate text-left font-semibold text-[var(--text1)] hover:text-[var(--accent)]">{item.name}</button> : <p className="truncate font-semibold text-[var(--text1)]">{item.name}</p>}<p className="text-xs text-[var(--text2)]">{item.kind === 'pdf' ? `${formatSize(item.size)} · ` : ''}{new Date(item.createdAt).toLocaleDateString()}</p></div>{item.kind === 'pdf' && <button type="button" disabled={busy} onClick={() => void downloadPdf(item)} title="Download PDF" className="rounded-lg p-2 text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--accent)] disabled:opacity-50"><Download size={18} /></button>}<button type="button" disabled={busy} onClick={() => setDeleteTarget(item)} title="Delete" className="rounded-lg p-2 text-[var(--text2)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"><Trash2 size={18} /></button></div>)}</div>}
      </div>
      <p className="text-xs text-[var(--text2)]">Resources are shared with signed-in members. PDF uploads are limited to 25 MB.</p>
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.kind === 'folder' ? 'folder' : 'PDF'}?`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteItem}
      />
    </section>
  )
}
