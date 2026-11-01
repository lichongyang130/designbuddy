import { useEffect, useState } from 'react'
import { ChevronDown, FileIcon, FolderIcon } from '../icons'
import type { FileEntry } from '../types'

interface Props {
  root: string | null
  onRead: (path: string) => Promise<{ path: string; content: string }>
}

export function WorkspaceView({ root, onRead }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [open, setOpen] = useState<{ path: string; content: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/workspace/files?recursive=1')
        const json = await response.json()
        if (!json.ok) throw new Error(json.error)
        setFiles(json.files as FileEntry[])
      } catch (cause) {
        setError((cause as Error).message)
      }
    })()
  }, [])

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>工作区文件</h1>
          <p className="page-sub">
            {root ? <code>{root}</code> : '未加载 workspace 插件'} · Agent 只能读写这个目录，越界路径会被拒绝
          </p>
        </div>
        <ChevronDown size={16} />
      </header>

      {error && <div className="banner">{error}</div>}

      <div className="file-layout">
        <div className="file-list">
          {files.length === 0 && <div className="muted pad">目录是空的</div>}
          {files.map((file) => (
            <button
              key={file.path}
              className={`file-row ${open?.path === file.path ? 'active' : ''}`}
              onClick={async () => {
                try {
                  setOpen(await onRead(file.path))
                } catch (cause) {
                  setError((cause as Error).message)
                }
              }}
            >
              {file.path.includes('/') ? <FolderIcon size={16} /> : <FileIcon size={16} />}
              <span className="file-path">{file.path}</span>
              <span className="file-size">{formatSize(file.size)}</span>
            </button>
          ))}
        </div>
        <div className="file-preview">
          {open ? (
            <>
              <div className="file-preview-head">
                <code>{open.path}</code>
              </div>
              <pre className="file-content">{open.content}</pre>
            </>
          ) : (
            <div className="muted pad">选一个文件查看内容</div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`
  return `${(size / 1024).toFixed(1)} KB`
}
