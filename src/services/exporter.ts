import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import workerURL from '@ffmpeg/ffmpeg/worker?worker&url'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { t } from '../i18n'
import fixWebmDuration from 'fix-webm-duration'
import type { ExportSettings, Project } from '../editor/types'
import { media, projectDuration } from '../editor/timelineMath'
import { audibleGainAt } from './audioEngine'
import { Compositor } from './compositor'
import { mediaPool } from './mediaPool'

export type ExportPhase = 'prepare' | 'render' | 'transcode' | 'done'

export interface ExportUpdate {
  phase: ExportPhase
  progress: number
  message: string
}

export interface ExportResult {
  blob: Blob
  extension: 'webm' | 'mp4'
}

type ProgressHandler = (update: ExportUpdate) => void

interface ExportVoice {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  url: string
}

const abortError = (): DOMException => new DOMException(t('service.exportAborted'), 'AbortError')

const checkAbort = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw abortError()
}

export const exportResolution = (
  project: Project,
  resolution: ExportSettings['resolution'],
): { width: number; height: number } => {
  const base =
    resolution === '720p'
      ? 720
      : resolution === '1440p'
        ? 1440
        : resolution === '4k'
          ? 2160
          : 1080
  const aspect = project.width / project.height
  const even = (value: number): number => Math.max(2, Math.round(value / 2) * 2)
  if (aspect >= 1) {
    return { width: even(base * aspect), height: even(base) }
  }
  return { width: even(base), height: even(base / aspect) }
}

const mimeFor = (): string => {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? 'video/webm'
}

const createVoices = (project: Project, context: AudioContext): Map<string, ExportVoice> => {
  const voices = new Map<string, ExportVoice>()
  for (const clip of project.clips) {
    if (clip.type !== 'audio' && clip.type !== 'video') continue
    if (clip.muted || !clip.mediaId) continue
    const asset = media(project, clip.mediaId)
    if (!asset?.hasAudio) continue
    const track = project.tracks.find((item) => item.id === clip.trackId)
    if (!track || track.muted) continue
    const url = mediaPool.url(clip.mediaId)
    if (!url) continue
    const element = document.createElement('audio')
    element.src = url
    element.preload = 'auto'
    element.crossOrigin = 'anonymous'
    element.currentTime = clip.sourceIn
    const source = context.createMediaElementSource(element)
    const gain = context.createGain()
    gain.gain.value = 0
    source.connect(gain)
    voices.set(clip.id, { element, source, gain, url })
  }
  return voices
}

const setPitch = (element: HTMLAudioElement, value: boolean): void => {
  const target = element as unknown as {
    preservesPitch?: boolean
    webkitPreservesPitch?: boolean
  }
  target.preservesPitch = value
  target.webkitPreservesPitch = value
}

const syncVoices = (
  voices: Map<string, ExportVoice>,
  project: Project,
  time: number,
  context: AudioContext,
): void => {
  for (const clip of project.clips) {
    const voice = voices.get(clip.id)
    if (!voice) continue
    const local = time - clip.start
    const active = local >= 0 && local < clip.duration
    if (!active) {
      if (!voice.element.paused) voice.element.pause()
      voice.gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.02)
      continue
    }
    const desired = Math.max(0, clip.sourceIn + local * clip.speed)
    if (Math.abs(voice.element.currentTime - desired) > 0.32) {
      voice.element.currentTime = desired
    }
    voice.element.playbackRate = clip.speed
    setPitch(voice.element, clip.preservePitch)
    const gain = audibleGainAt(project, clip, time)
    voice.gain.gain.setTargetAtTime(Math.max(0.0001, gain), context.currentTime, 0.014)
    if (voice.element.paused) void voice.element.play().catch(() => undefined)
  }
}

const primeVideos = async (project: Project): Promise<void> => {
  await Promise.all(
    project.clips
      .filter((clip) => clip.type === 'video' && clip.mediaId)
      .map(
        (clip) =>
          new Promise<void>((resolve) => {
            const video = mediaPool.video(clip.mediaId as string)
            if (!video || video.readyState >= 2) {
              resolve()
              return
            }
            const timer = window.setTimeout(resolve, 8000)
            video.addEventListener(
              'loadeddata',
              () => {
                window.clearTimeout(timer)
                resolve()
              },
              { once: true },
            )
          }),
      ),
  )
}

const renderAudio = async (
  project: Project,
  canvas: HTMLCanvasElement,
  compositor: Compositor,
  settings: ExportSettings,
  signal: AbortSignal | undefined,
  onProgress: ProgressHandler,
): Promise<Blob> => {
  const context = new AudioContext()
  await context.resume()
  const destination = context.createMediaStreamDestination()
  const voices = createVoices(project, context)
  for (const voice of voices.values()) voice.gain.connect(destination)
  const stream = canvas.captureStream(settings.fps)
  for (const track of destination.stream.getAudioTracks()) stream.addTrack(track)
  const mimeType = mimeFor()
  const pixels = canvas.width * canvas.height
  const bitsPerPixel = settings.quality === 'high' ? 0.12 : 0.062
  const videoBitsPerSecond = Math.round(
    Math.max(1_500_000, Math.min(36_000_000, pixels * settings.fps * bitsPerPixel)),
  )
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond,
    audioBitsPerSecond: 192_000,
  })
  const chunks: BlobPart[] = []
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(), { once: true })
    recorder.addEventListener('error', () => reject(new Error(t('service.mediaRecorder'))), { once: true })
  })
  const duration = projectDuration(project)
  const startedAt = performance.now()
  recorder.start(1000)
  let raf = 0
  try {
    await new Promise<void>((resolve, reject) => {
      const frame = (): void => {
        try {
          if (signal?.aborted) {
            reject(abortError())
            return
          }
          const elapsed = (performance.now() - startedAt) / 1000
          if (elapsed >= duration) {
            syncVoices(voices, project, duration - 0.001, context)
            onProgress({
              phase: 'render',
              progress: 1,
              message: t('service.exportClosing'),
            })
            resolve()
            return
          }
          syncVoices(voices, project, elapsed, context)
          compositor.render(project, elapsed, true)
          onProgress({
            phase: 'render',
            progress: Math.min(1, elapsed / Math.max(0.01, duration)),
            message: t('service.exportRendering', {
              current: Math.ceil(elapsed),
              total: Math.ceil(duration),
            }),
          })
          raf = requestAnimationFrame(frame)
        } catch (reason) {
          reject(reason)
        }
      }
      raf = requestAnimationFrame(frame)
    })
    recorder.stop()
    await stopped
  } catch (reason) {
    if (recorder.state !== 'inactive') recorder.stop()
    throw reason
  } finally {
    cancelAnimationFrame(raf)
    for (const voice of voices.values()) {
      voice.element.pause()
      voice.source.disconnect()
      voice.gain.disconnect()
      voice.element.removeAttribute('src')
      voice.element.load()
    }
    for (const track of stream.getTracks()) track.stop()
    await context.close()
  }
  const recorded = new Blob(chunks, { type: mimeType.split(';')[0] })
  return fixWebmDuration(recorded, Math.max(1000, Math.round(duration * 1000)), {
    logger: false,
  })
}

export const transcodeToMp4 = async (
  input: Blob,
  settings: ExportSettings,
  signal: AbortSignal | undefined,
  onProgress: ProgressHandler,
): Promise<Blob> => {
  checkAbort(signal)
  const ffmpeg = new FFmpeg()
  let terminated = false
  const abort = (): void => {
    if (terminated) return
    terminated = true
    ffmpeg.terminate()
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    onProgress({ phase: 'transcode', progress: 0, message: t('service.exportPreparingEncoder') })
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL: workerURL })
    checkAbort(signal)
    ffmpeg.on('progress', ({ progress }) => {
      const ratio = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
      onProgress({
        phase: 'transcode',
        progress: ratio,
        message: t('service.exportTranscoding', { percent: Math.round(ratio * 100) }),
      })
    })
    await ffmpeg.writeFile('input.webm', new Uint8Array(await input.arrayBuffer()))
    const quality = settings.quality === 'high' ? '18' : '23'
    let code = await ffmpeg.exec([
      '-i',
      'input.webm',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      quality,
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      'output.mp4',
    ])
    if (code !== 0) {
      await ffmpeg.deleteFile('output.mp4').catch(() => undefined)
      code = await ffmpeg.exec([
        '-i',
        'input.webm',
        '-c:v',
        'mpeg4',
        '-q:v',
        settings.quality === 'high' ? '3' : '6',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-movflags',
        '+faststart',
        'output.mp4',
      ])
    }
    if (code !== 0) throw new Error(t('service.mp4Encode'))
    checkAbort(signal)
    const data = await ffmpeg.readFile('output.mp4')
    if (typeof data === 'string') throw new Error(t('service.mp4Invalid'))
    const bytes = new Uint8Array(data.byteLength)
    bytes.set(data)
    return new Blob([bytes], { type: 'video/mp4' })
  } catch (reason) {
    if (signal?.aborted) throw abortError()
    throw reason
  } finally {
    signal?.removeEventListener('abort', abort)
    terminated = true
    ffmpeg.terminate()
  }
}

export const exportProject = async (
  project: Project,
  settings: ExportSettings,
  onProgress: ProgressHandler,
  signal?: AbortSignal,
): Promise<ExportResult> => {
  const duration = projectDuration(project)
  if (duration <= 0) throw new Error(t('export.empty'))
  if (typeof MediaRecorder === 'undefined') {
    throw new Error(t('service.mediaRecorderUnsupported'))
  }
  const { width, height } = exportResolution(project, settings.resolution)
  if (width * height > 8_300_000) {
    onProgress({
      phase: 'prepare',
      progress: 0,
      message: t('service.exportHighRes'),
    })
  }
  await document.fonts.ready
  onProgress({ phase: 'prepare', progress: 0, message: t('service.exportPreparingMedia') })
  await primeVideos(project)
  checkAbort(signal)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const compositor = new Compositor(canvas)
  try {
    compositor.render(project, 0, false)
    onProgress({ phase: 'render', progress: 0, message: t('service.exportStartRender') })
    const webm = await renderAudio(project, canvas, compositor, settings, signal, onProgress)
    if (settings.format === 'webm') {
      onProgress({ phase: 'done', progress: 1, message: t('service.exportWebmReady') })
      return { blob: webm, extension: 'webm' }
    }
    const mp4 = await transcodeToMp4(webm, settings, signal, (update) => {
      onProgress({
        phase: 'transcode',
        progress: update.progress,
        message: update.message,
      })
    })
    onProgress({ phase: 'done', progress: 1, message: t('service.exportMp4Ready') })
    return { blob: mp4, extension: 'mp4' }
  } finally {
    compositor.dispose()
  }
}
