import type { Clip, Project } from '../editor/types'
import { animatedValue } from '../editor/keyframes'
import { media } from '../editor/timelineMath'
import { mediaPool } from './mediaPool'

interface Voice {
  element: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  url: string
}

const preservesPitch = (element: HTMLAudioElement, value: boolean): void => {
  const target = element as unknown as {
    preservesPitch?: boolean
    webkitPreservesPitch?: boolean
  }
  target.preservesPitch = value
  target.webkitPreservesPitch = value
}

export const audibleGainAt = (project: Project, clip: Clip, time: number): number => {
  const local = time - clip.start
  if (local < 0 || local > clip.duration) return 0
  const track = project.tracks.find((item) => item.id === clip.trackId)
  if (!track || track.muted || clip.muted) return 0
  let gain = animatedValue(clip, 'volume', local) * track.volume
  if (clip.fadeIn > 0) gain *= Math.min(1, local / clip.fadeIn)
  if (clip.fadeOut > 0) gain *= Math.min(1, (clip.duration - local) / clip.fadeOut)
  if (clip.transitionIn && clip.transitionIn.duration > 0) {
    gain *= Math.min(1, local / clip.transitionIn.duration)
  }
  const next = project.clips
    .filter((item) => item.trackId === clip.trackId && item.start > clip.start)
    .sort((a, b) => a.start - b.start)[0]
  if (next?.transitionIn && next.transitionIn.duration > 0) {
    const incoming = time - next.start
    if (incoming >= 0 && incoming <= next.transitionIn.duration) {
      gain *= 1 - incoming / next.transitionIn.duration
    }
  }
  return Math.max(0, Math.min(2.5, gain))
}

class AudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private voices = new Map<string, Voice>()

  private ensure(): AudioContext | null {
    if (this.context) return this.context
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const context = new Ctor()
    const master = context.createGain()
    master.gain.value = 0.92
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -4
    compressor.knee.value = 18
    compressor.ratio.value = 10
    compressor.attack.value = 0.004
    compressor.release.value = 0.18
    master.connect(compressor)
    compressor.connect(context.destination)
    this.context = context
    this.master = master
    return context
  }

  resume(): void {
    const context = this.ensure()
    if (context && context.state === 'suspended') void context.resume()
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend()
  }

  private createVoice(clip: Clip, url: string): Voice | null {
    const context = this.ensure()
    if (!context || !this.master) return null
    const element = document.createElement('audio')
    element.src = url
    element.preload = 'auto'
    element.crossOrigin = 'anonymous'
    const source = context.createMediaElementSource(element)
    const gain = context.createGain()
    gain.gain.value = 0
    source.connect(gain)
    gain.connect(this.master)
    const voice: Voice = { element, source, gain, url }
    this.voices.set(clip.id, voice)
    return voice
  }

  private cleanupVoice(id: string): void {
    const voice = this.voices.get(id)
    if (!voice) return
    voice.element.pause()
    voice.source.disconnect()
    voice.gain.disconnect()
    voice.element.removeAttribute('src')
    voice.element.load()
    this.voices.delete(id)
  }

  sync(project: Project, time: number, playing: boolean): void {
    const context = this.ensure()
    if (!context) return
    const active = new Set<string>()
    for (const clip of project.clips) {
      if (clip.type !== 'audio' && clip.type !== 'video') continue
      if (clip.muted || !clip.mediaId) continue
      const local = time - clip.start
      if (local < 0 || local >= clip.duration) continue
      const asset = media(project, clip.mediaId)
      if (!asset?.hasAudio) continue
      const track = project.tracks.find((item) => item.id === clip.trackId)
      if (!track || track.muted) continue
      const url = mediaPool.url(clip.mediaId)
      if (!url) continue
      active.add(clip.id)
      let voice = this.voices.get(clip.id)
      if (voice && voice.url !== url) {
        this.cleanupVoice(clip.id)
        voice = undefined
      }
      if (!voice) voice = this.createVoice(clip, url) ?? undefined
      if (!voice) continue

      const desired = Math.max(0, clip.sourceIn + local * clip.speed)
      const element = voice.element
      if (Math.abs(element.currentTime - desired) > 0.32) {
        element.currentTime = desired
      }
      element.playbackRate = Math.max(0.25, Math.min(4, clip.speed))
      preservesPitch(element, clip.preservePitch)
      const gain = audibleGainAt(project, clip, time)
      const now = context.currentTime
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setTargetAtTime(Math.max(0.0001, gain), now, 0.018)

      if (playing) {
        if (element.paused) void element.play().catch(() => undefined)
      } else if (!element.paused) {
        element.pause()
      }
    }

    for (const id of [...this.voices.keys()]) {
      if (active.has(id)) continue
      const voice = this.voices.get(id)
      if (!voice) continue
      voice.element.pause()
      voice.gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.02)
    }
  }

  seek(project: Project, time: number): void {
    this.sync(project, time, false)
  }

  reset(): void {
    for (const id of [...this.voices.keys()]) this.cleanupVoice(id)
  }

  dispose(): void {
    this.reset()
    if (this.context) {
      void this.context.close()
      this.context = null
      this.master = null
    }
  }
}

export const audioEngine = new AudioEngine()
