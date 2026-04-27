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
