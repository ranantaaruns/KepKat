class MediaPool {
  private blobs = new Map<string, Blob>()
  private urls = new Map<string, string>()
  private videos = new Map<string, HTMLVideoElement>()
  private audios = new Map<string, HTMLAudioElement>()
  private images = new Map<string, HTMLImageElement>()

  setBlob(id: string, blob: Blob): void {
    this.release(id)
    this.blobs.set(id, blob)
    this.urls.set(id, URL.createObjectURL(blob))
  }

  setUrl(id: string, url: string): void {
    this.release(id)
    this.urls.set(id, url)
  }

  has(id: string): boolean {
    return this.urls.has(id)
  }

  blob(id: string): Blob | undefined {
    return this.blobs.get(id)
  }

  url(id: string): string | undefined {
    return this.urls.get(id)
  }

  video(id: string): HTMLVideoElement | undefined {
    const existing = this.videos.get(id)
    if (existing) return existing
    const url = this.urls.get(id)
    if (!url) return undefined
    const video = document.createElement('video')
    video.src = url
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    this.videos.set(id, video)
    return video
  }

  audio(id: string): HTMLAudioElement | undefined {
    const existing = this.audios.get(id)
    if (existing) return existing
    const url = this.urls.get(id)
    if (!url) return undefined
    const audio = document.createElement('audio')
    audio.src = url
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    this.audios.set(id, audio)
    return audio
  }

  image(id: string): HTMLImageElement | undefined {
    const existing = this.images.get(id)
    if (existing) return existing
    const url = this.urls.get(id)
    if (!url) return undefined
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    this.images.set(id, image)
    return image
  }

  syncVideo(id: string, time: number, playing: boolean): HTMLVideoElement | undefined {
    const video = this.video(id)
    if (!video) return undefined
    const target = Math.max(0, time)
    if (video.readyState >= 2) {
      if (Math.abs(video.currentTime - target) > 0.28) {
        video.currentTime = target
      }
      if (playing) {
        if (video.paused) {
          void video.play().catch(() => undefined)
        }
      } else if (!video.paused) {
        video.pause()
      }
    }
    return video
  }

  release(id: string): void {
    const url = this.urls.get(id)
    if (url) URL.revokeObjectURL(url)
    this.urls.delete(id)
    this.blobs.delete(id)
    const video = this.videos.get(id)
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
      this.videos.delete(id)
    }
    const audio = this.audios.get(id)
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      this.audios.delete(id)
    }
    this.images.delete(id)
  }

  clear(): void {
    for (const id of [...this.urls.keys()]) this.release(id)
  }
}

export const mediaPool = new MediaPool()
