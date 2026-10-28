import { uid } from '../editor/defaults'
import type { MediaAsset, MediaKind } from '../editor/types'

const THUMBNAIL_WIDTH = 360

export const mediaKind = (file: File): MediaKind | null => {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('image/')) return 'image'
  return null
}

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const waitFor = <T extends HTMLElement>(
  element: T,
  event: string,
  timeout = 12000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('Media terlalu lama dimuat atau formatnya tidak didukung browser.'))
    }, timeout)
    const onDone = () => {
      cleanup()
      resolve(element)
    }
    const onError = () => {
      cleanup()
      reject(new Error('Media tidak bisa dibaca. Coba format WebM, MP4, MP3, WAV, PNG, atau JPG.'))
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      element.removeEventListener(event, onDone)
      element.removeEventListener('error', onError)
    }
    element.addEventListener(event, onDone, { once: true })
    element.addEventListener('error', onError, { once: true })
  })

const canvasThumbnail = (source: CanvasImageSource, width: number, height: number): string => {
  const ratio = height / width || 9 / 16
  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_WIDTH
  canvas.height = Math.max(1, Math.round(THUMBNAIL_WIDTH * ratio))
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.fillStyle = '#101214'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const scale = Math.max(canvas.width / width, canvas.height / height)
  const drawWidth = width * scale
  const drawHeight = height * scale
  context.drawImage(
    source,
    (canvas.width - drawWidth) / 2,
    (canvas.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  )
  return canvas.toDataURL('image/jpeg', 0.68)
}

const settleDuration = async (media: HTMLMediaElement): Promise<number> => {
  if (Number.isFinite(media.duration) && media.duration > 0) return media.duration
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      media.removeEventListener('durationchange', finish)
      media.removeEventListener('seeked', finish)
      window.clearTimeout(timer)
      resolve()
    }
    const timer = window.setTimeout(finish, 4000)
    media.addEventListener('durationchange', finish)
    media.addEventListener('seeked', finish)
    try {
      media.currentTime = Number.MAX_SAFE_INTEGER
    } catch {
      finish()
    }
  })
  return Number.isFinite(media.duration) && media.duration > 0 ? media.duration : 0
}

const probeVideo = async (
  url: string,
): Promise<{ duration: number; width: number; height: number; thumbnail: string }> => {
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  video.src = url
  await waitFor(video, 'loadedmetadata')
  const duration = await settleDuration(video)
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720
  let thumbnail = ''
  try {
    video.currentTime = Math.min(Math.max(0.05, duration * 0.04), Math.max(0.05, duration - 0.05))
    await waitFor(video, 'seeked', 6000)
    thumbnail = canvasThumbnail(video, width, height)
  } catch {
    thumbnail = ''
  }
  return { duration, width, height, thumbnail }
}

const probeAudio = async (url: string): Promise<number> => {
  const audio = document.createElement('audio')
  audio.preload = 'metadata'
  audio.src = url
  await waitFor(audio, 'loadedmetadata')
  return Number.isFinite(audio.duration) ? audio.duration : 0
}

const probeImage = async (
  url: string,
): Promise<{ width: number; height: number; thumbnail: string }> => {
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  await waitFor(image, 'load')
  const width = image.naturalWidth || 1280
  const height = image.naturalHeight || 720
  return { width, height, thumbnail: canvasThumbnail(image, width, height) }
}

export const buildWaveform = async (blob: Blob, bars = 72): Promise<number[]> => {
  if (typeof OfflineAudioContext === 'undefined' && typeof AudioContext === 'undefined') return []
  const context = new AudioContext()
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer())
    const channel = buffer.getChannelData(0)
    const block = Math.max(1, Math.floor(channel.length / bars))
    const peaks: number[] = []
    for (let i = 0; i < bars; i += 1) {
      let peak = 0
      const start = i * block
      const end = Math.min(channel.length, start + block)
      for (let j = start; j < end; j += 1) {
        const value = Math.abs(channel[j])
        if (value > peak) peak = value
      }
      peaks.push(Math.min(1, Math.max(0.02, peak)))
    }
    const max = Math.max(...peaks, 0.01)
    return peaks.map((value) => Math.max(0.03, value / max))
  } catch {
    return []
  } finally {
    void context.close()
  }
}

export const createMediaAsset = async (file: File): Promise<MediaAsset> => {
  const kind = mediaKind(file)
  if (!kind) {
    throw new Error('Format file belum didukung. Gunakan video, audio, atau gambar.')
  }
  const url = URL.createObjectURL(file)
  try {
    const base: MediaAsset = {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, '') || file.name,
      kind,
      mime: file.type,
      duration: kind === 'image' ? 5 : 0,
      width: 0,
      height: 0,
      hasAudio: kind === 'audio',
      createdAt: Date.now(),
    }
    if (kind === 'video') {
      const info = await probeVideo(url)
      return {
        ...base,
        ...info,
        hasAudio: true,
      }
    }
    if (kind === 'audio') {
      const duration = await probeAudio(url)
      return { ...base, duration, hasAudio: true }
    }
    const info = await probeImage(url)
    return { ...base, ...info }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const createAssetWithWaveform = async (
  file: File,
): Promise<{ asset: MediaAsset; waveform: number[] }> => {
  const asset = await createMediaAsset(file)
  if (asset.kind !== 'audio') return { asset, waveform: [] }
  const waveform = await buildWaveform(file)
  return { asset: { ...asset, waveform }, waveform }
}

export const fileExtension = (file: File): string => {
  const match = /\.([^.]+)$/.exec(file.name)
  return match ? match[1].toLowerCase() : ''
}
