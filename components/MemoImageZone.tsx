'use client'

import { useRef, useState } from 'react'
import type { MemoImage } from '@/lib/types'
import { apiFetch } from '@/lib/api'

interface Props {
  memoId: string
  images: MemoImage[]
  onUpdate: (images: MemoImage[]) => void
}

export default function MemoImageZone({ memoId, images, onUpdate }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch(`/api/uploads?memoId=${memoId}`, { method: 'POST', body: form })
      if (!res.ok) return
      const image: MemoImage = await res.json()
      onUpdate([...images, image])
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이미지를 삭제하시겠습니까?')) return
    await apiFetch(`/api/memo-images/${id}`, { method: 'DELETE' })
    onUpdate(images.filter(img => img.id !== id))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  function onPaste(e: React.ClipboardEvent) {
    const file = Array.from(e.clipboardData.items)
      .find(item => item.type.startsWith('image/'))
      ?.getAsFile()
    if (file) upload(file)
  }

  const imgSrc = (filename: string) =>
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/images/${filename}`

  return (
    <div className="space-y-2" onPaste={onPaste}>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(img => (
            <div key={img.id} className="relative group">
              <img
                src={imgSrc(img.filename)}
                alt="메모 이미지"
                className="h-20 w-auto rounded border border-gray-200 cursor-pointer object-cover hover:opacity-90 transition-opacity"
                onClick={() => setLightbox(imgSrc(img.filename))}
              />
              <button
                onClick={() => handleDelete(img.id)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 text-xs leading-none hidden group-hover:flex items-center justify-center"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-3 py-2 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <p className="text-xs text-gray-400">
          {uploading ? '업로드 중...' : '이미지를 드래그하거나 클릭, 또는 Ctrl+V'}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
      />

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="메모 이미지 원본"
            className="max-w-full max-h-full rounded shadow-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white text-2xl leading-none hover:text-gray-300"
          >×</button>
        </div>
      )}
    </div>
  )
}
