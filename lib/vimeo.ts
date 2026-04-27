/**
 * Extract Vimeo video ID from various URL formats:
 * - https://vimeo.com/123456789
 * - https://player.vimeo.com/video/123456789
 * - https://vimeo.com/channels/xxx/123456789
 * - https://vimeo.com/groups/xxx/videos/123456789
 * - 123456789 (just the ID)
 */
export function extractVimeoId(input: string): string | null {
  if (!input) return null

  // If it's just a number, return as-is
  if (/^\d+$/.test(input.trim())) {
    return input.trim()
  }

  const patterns = [
    /vimeo\.com\/(?:video\/)?(\d+)/,
    /vimeo\.com\/channels\/[\w-]+\/(\d+)/,
    /vimeo\.com\/groups\/[\w-]+\/videos\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match) return match[1]
  }

  return null
}

export function getVimeoEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}`
}

/**
 * Fetch video metadata from Vimeo API
 * Requires VIMEO_ACCESS_TOKEN env var
 */
export interface VimeoVideoMeta {
  name: string
  description: string | null
  duration: number // seconds
  thumbnail_url: string | null
  width: number
  height: number
}

export async function fetchVimeoVideo(videoId: string): Promise<VimeoVideoMeta | null> {
  const token = process.env.VIMEO_ACCESS_TOKEN
  if (!token) return null

  try {
    const res = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) return null

    const data = await res.json()

    return {
      name: data.name || '',
      description: data.description || null,
      duration: data.duration || 0,
      thumbnail_url: data.pictures?.sizes?.[3]?.link || data.pictures?.sizes?.[0]?.link || null,
      width: data.width || 0,
      height: data.height || 0,
    }
  } catch {
    return null
  }
}

/**
 * List videos from the authenticated user's Vimeo account
 */
export interface VimeoVideoListItem {
  id: string
  name: string
  duration: number
  thumbnail_url: string | null
  created_time: string
}

export async function listVimeoVideos(page = 1, perPage = 20): Promise<{ videos: VimeoVideoListItem[]; total: number } | null> {
  const token = process.env.VIMEO_ACCESS_TOKEN
  if (!token) return null

  try {
    const res = await fetch(
      `https://api.vimeo.com/me/videos?page=${page}&per_page=${perPage}&sort=date&direction=desc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) return null

    const data = await res.json()

    const videos: VimeoVideoListItem[] = (data.data || []).map((v: Record<string, unknown>) => ({
      id: (v.uri as string)?.split('/').pop() || '',
      name: v.name as string || '',
      duration: v.duration as number || 0,
      thumbnail_url: (v.pictures as Record<string, unknown[]>)?.sizes?.[2]
        ? ((v.pictures as Record<string, Record<string, string>[]>).sizes[2]?.link || null)
        : null,
      created_time: v.created_time as string || '',
    }))

    return { videos, total: data.total || 0 }
  } catch {
    return null
  }
}
