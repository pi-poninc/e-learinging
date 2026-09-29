import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { unzipSync } from 'fflate'

const BUCKET = 'lesson-files'
const MAX_MB = 50
const TEXT_EXT = ['md', 'txt', 'csv', 'json', 'log', 'yaml', 'yml']

// 中身プレビュー（テキストは本文、zipは中のファイル名一覧）を計算
function buildPreview(name: string, bytes: Uint8Array): { preview_text: string | null; zip_entries: string[] | null } {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (TEXT_EXT.includes(ext)) {
    try {
      return { preview_text: new TextDecoder('utf-8').decode(bytes).slice(0, 8000), zip_entries: null }
    } catch {
      return { preview_text: null, zip_entries: null }
    }
  }
  if (ext === 'zip') {
    try {
      const files = unzipSync(bytes)
      const entries = Object.keys(files).filter((k) => !k.endsWith('/'))
      return { preview_text: null, zip_entries: entries }
    } catch {
      return { preview_text: null, zip_entries: null }
    }
  }
  return { preview_text: null, zip_entries: null }
}

async function requireAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'instructor'].includes(profile.role)) return null
  return user
}

// POST(multipart): lessonId + file → Storageへ保存し lesson_attachments に登録
export async function POST(request: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await request.formData()
  const lessonId = form.get('lessonId') as string
  const file = form.get('file') as File | null
  if (!lessonId || !file) {
    return NextResponse.json({ error: 'lessonId とファイルは必須です' }, { status: 400 })
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: `ファイルサイズが上限(${MAX_MB}MB)を超えています` }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const svc = await createServiceClient()
  // ストレージキーは安全な文字だけに（表示名は元のまま保持）
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${lessonId}/${Date.now()}_${safe}`
  const { error: upErr } = await svc.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { preview_text, zip_entries } = buildPreview(file.name, bytes)
  const { data: urlData } = svc.storage.from(BUCKET).getPublicUrl(path)
  const { data, error } = await svc.from('lesson_attachments').insert({
    lesson_id: lessonId,
    file_name: file.name,
    file_url: urlData.publicUrl,
    storage_path: path,
    size_bytes: file.size,
    preview_text,
    zip_entries,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ attachment: data })
}

// DELETE ?id= : 添付を削除（Storage実体も削除）
export async function DELETE(request: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })

  const svc = await createServiceClient()
  const { data: row } = await svc.from('lesson_attachments').select('storage_path').eq('id', id).maybeSingle()
  if (row?.storage_path) {
    await svc.storage.from(BUCKET).remove([row.storage_path])
  }
  const { error } = await svc.from('lesson_attachments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
