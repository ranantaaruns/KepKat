import type {
  Clip,
  ColorGrade,
  MediaAsset,
  Project,
  TransitionType,
} from '../editor/types'
import { animatedValue } from '../editor/keyframes'
import {
  activeClipsOnTrack,
  clipEnd,
  media,
  sourceTimeFor,
  visualTracks,
} from '../editor/timelineMath'
import { mediaPool } from './mediaPool'

const VERT_LAYER = `#version 300 es
in vec2 a_pos;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_size;
uniform float u_rotation;
out vec2 v_uv;
void main() {
  vec2 local = (a_pos - 0.5) * u_size;
  float c = cos(u_rotation);
  float s = sin(u_rotation);
  local = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 pixel = u_center + local;
  vec2 clip = vec2(pixel.x / u_resolution.x * 2.0 - 1.0, 1.0 - pixel.y / u_resolution.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_pos;
}`

const FRAG_LAYER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform vec2 u_texel;
uniform float u_time;
uniform float u_opacity;
uniform float u_exposure;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_temperature;
uniform float u_tint;
uniform float u_highlights;
uniform float u_shadows;
uniform float u_vibrance;
uniform float u_sharpness;
uniform float u_vignette;
uniform float u_grain;
uniform float u_chromaEnabled;
uniform vec3 u_keyColor;
uniform float u_similarity;
uniform float u_smoothness;
uniform float u_spill;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec4 src = texture(u_tex, v_uv);
  if (src.a < 0.002) {
    outColor = vec4(0.0);
    return;
  }
  vec3 color = src.rgb;
  float alpha = src.a;

  if (u_chromaEnabled > 0.5) {
    float dist = distance(color, u_keyColor);
    float mask = smoothstep(u_similarity, u_similarity + max(u_smoothness, 0.001), dist);
    float spillMask = (1.0 - mask) * u_spill;
    float greenLimit = (color.r + color.b) * 0.55;
    color.g = mix(color.g, min(color.g, greenLimit), spillMask);
    alpha *= mask;
  }

  color *= pow(2.0, u_exposure * 2.0);
  color = (color - 0.5) * (1.0 + u_contrast) + 0.5;
  float l = luma(color);
  color = mix(vec3(l), color, 1.0 + u_saturation);
  float sat = max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
  color = mix(vec3(luma(color)), color, 1.0 + u_vibrance * (1.0 - sat));
  color.r += u_temperature * 0.075;
  color.b -= u_temperature * 0.075;
  color.g += u_tint * 0.055;
  color.r -= u_tint * 0.02;
  color.b += u_tint * 0.02;

  float l2 = luma(color);
  float shadowMask = 1.0 - smoothstep(0.0, 0.55, l2);
  float highlightMask = smoothstep(0.45, 1.0, l2);
  color += shadowMask * u_shadows * 0.35;
  color += highlightMask * u_highlights * 0.35;

  if (u_sharpness > 0.001) {
    vec3 blur = (
      texture(u_tex, v_uv + vec2(u_texel.x, 0.0)).rgb +
      texture(u_tex, v_uv - vec2(u_texel.x, 0.0)).rgb +
      texture(u_tex, v_uv + vec2(0.0, u_texel.y)).rgb +
      texture(u_tex, v_uv - vec2(0.0, u_texel.y)).rgb
    ) * 0.25;
    color += (color - blur) * u_sharpness * 2.2;
  }

  float vignette = smoothstep(0.28, 0.82, distance(v_uv, vec2(0.5)));
  color *= 1.0 - vignette * u_vignette;
  float grain = hash21(v_uv * u_resolution + vec2(u_time * 31.0, u_time * 17.0)) - 0.5;
  color += grain * u_grain * 0.22;

  color = clamp(color, 0.0, 1.0);
  outColor = vec4(color, clamp(alpha, 0.0, 1.0) * u_opacity);
}`

const VERT_FULL = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);
}`

const FRAG_PRESENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texture(u_tex, v_uv);
}`

const FRAG_TRANSITION = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
uniform int u_type;
uniform vec2 u_dir;
uniform float u_time;
uniform vec2 u_texel;

vec4 sampleSafe(sampler2D tex, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture(tex, uv);
}

vec4 blurSample(sampler2D tex, vec2 uv, float radius) {
  vec4 total = texture(tex, uv) * 0.4;
  total += sampleSafe(tex, uv + vec2(radius, 0.0)) * 0.15;
  total += sampleSafe(tex, uv - vec2(radius, 0.0)) * 0.15;
  total += sampleSafe(tex, uv + vec2(0.0, radius)) * 0.15;
  total += sampleSafe(tex, uv - vec2(0.0, radius)) * 0.15;
  return total;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 rotateUv(vec2 uv, float angle) {
  vec2 p = uv - 0.5;
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c) + 0.5;
}

void main() {
  float p = clamp(u_progress, 0.0, 1.0);
  vec4 a = texture(u_from, v_uv);
  vec4 b = texture(u_to, v_uv);

  if (u_type == 0) {
    outColor = mix(a, b, p);
    return;
  }
  if (u_type == 1) {
    if (p < 0.5) outColor = mix(a, vec4(0.0, 0.0, 0.0, a.a), p * 2.0);
    else outColor = mix(vec4(0.0, 0.0, 0.0, b.a), b, (p - 0.5) * 2.0);
    return;
  }
  if (u_type == 2 || u_type == 7) {
    float blurAmt = (u_type == 7 ? 0.012 : 0.0) * sin(p * 3.14159);
    vec2 uvA = v_uv + u_dir * p;
    vec2 uvB = v_uv - u_dir * (1.0 - p);
    vec4 base = blurAmt > 0.0001 ? blurSample(u_from, uvA, blurAmt) : sampleSafe(u_from, uvA);
    vec4 incoming = blurAmt > 0.0001 ? blurSample(u_to, uvB, blurAmt) : sampleSafe(u_to, uvB);
    outColor = mix(base, incoming, incoming.a);
    return;
  }
  if (u_type == 3) {
    float za = 1.0 + p * 0.28;
    float zb = 1.28 - p * 0.28;
    vec2 uvA = (v_uv - 0.5) / za + 0.5;
    vec2 uvB = (v_uv - 0.5) / zb + 0.5;
    outColor = mix(sampleSafe(u_from, uvA), sampleSafe(u_to, uvB), p);
    return;
  }
  if (u_type == 4) {
    float axis = u_dir.x != 0.0 ? v_uv.x : v_uv.y;
    if (u_dir.x < 0.0 || u_dir.y < 0.0) axis = 1.0 - axis;
    float edge = p * 1.12 - 0.06;
    float mask = smoothstep(edge - 0.035, edge + 0.035, axis);
    outColor = mix(a, b, mask);
    return;
  }
  if (u_type == 5) {
    float radius = sin(p * 3.14159) * 0.022;
    outColor = mix(blurSample(u_from, v_uv, radius), blurSample(u_to, v_uv, radius), p);
    return;
  }
  if (u_type == 6) {
    float line = floor(v_uv.y * 28.0);
    float jitter = (hash21(vec2(line, floor(u_time * 24.0))) - 0.5) * 0.075 * sin(p * 3.14159);
    vec2 uv = v_uv + vec2(jitter, 0.0);
    float split = 0.014 * sin(p * 3.14159);
    vec4 ca = vec4(
      sampleSafe(u_from, uv + vec2(split, 0.0)).r,
      sampleSafe(u_from, uv).g,
      sampleSafe(u_from, uv - vec2(split, 0.0)).b,
      sampleSafe(u_from, uv).a
    );
    vec4 cb = vec4(
      sampleSafe(u_to, uv + vec2(split, 0.0)).r,
      sampleSafe(u_to, uv).g,
      sampleSafe(u_to, uv - vec2(split, 0.0)).b,
      sampleSafe(u_to, uv).a
    );
    outColor = mix(ca, cb, p);
    return;
  }
  if (u_type == 8) {
    vec2 uvA = rotateUv(v_uv, (1.0 - p) * 0.22);
    vec2 uvB = rotateUv(v_uv, -(1.0 - p) * 0.3);
    outColor = mix(sampleSafe(u_from, uvA), sampleSafe(u_to, uvB), p);
    return;
  }
  if (u_type == 9) {
    vec4 mixed = mix(a, b, p);
    float band = pow(max(0.0, 1.0 - abs(v_uv.x - p) * 6.0), 3.0);
    vec3 warm = vec3(1.0, 0.56, 0.26) * band * 0.75 * sin(p * 3.14159);
    outColor = vec4(mixed.rgb + warm, mixed.a);
    return;
  }
  outColor = mix(a, b, p);
}`

const TRANSITION_CODES: Record<TransitionType, number> = {
  dissolve: 0,
  fade: 1,
  slide: 2,
  zoom: 3,
  wipe: 4,
  blur: 5,
  glitch: 6,
  whip: 7,
  rotate: 8,
  light: 9,
}

interface Target {
  fbo: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
}

interface MediaTexture {
  texture: WebGLTexture
  width: number
  height: number
  uploaded: boolean
}

interface TextTexture {
  texture: WebGLTexture
  canvas: HTMLCanvasElement
  signature: string
}

class GlProgram {
  readonly program: WebGLProgram
  private gl: WebGL2RenderingContext
  private uniforms = new Map<string, WebGLUniformLocation | null>()

  constructor(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
    this.gl = gl
    const compile = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Shader tidak bisa dibuat.')
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) ?? 'Shader gagal dikompilasi.'
        gl.deleteShader(shader)
        throw new Error(message)
      }
      return shader
    }
    const vs = compile(gl.VERTEX_SHADER, vertex)
    const fs = compile(gl.FRAGMENT_SHADER, fragment)
    const program = gl.createProgram()
    if (!program) throw new Error('Program WebGL tidak bisa dibuat.')
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? 'Program WebGL gagal ditautkan.'
      gl.deleteProgram(program)
      throw new Error(message)
    }
    this.program = program
  }

  use(): void {
    this.gl.useProgram(this.program)
  }

  u(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program, name))
    }
    return this.uniforms.get(name) ?? null
  }
}

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const number = Number.parseInt(value || '000000', 16)
  return [((number >> 16) & 255) / 255, ((number >> 8) & 255) / 255, (number & 255) / 255]
}

const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`
}

const directionVector = (clip: Clip): [number, number] => {
  switch (clip.transitionIn?.direction) {
    case 'right':
      return [-1, 0]
    case 'up':
      return [0, 1]
    case 'down':
      return [0, -1]
    default:
      return [1, 0]
  }
}

const fitScale = (
  fit: 'contain' | 'cover',
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): number => {
  const sx = width / Math.max(1, sourceWidth)
  const sy = height / Math.max(1, sourceHeight)
  return fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy)
}

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('')
      continue
    }
    const words = paragraph.split(/\s+/)
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }
    lines.push(current)
  }
  return lines
}

export class Compositor {
  private gl: WebGL2RenderingContext
  private layerProgram: GlProgram
  private presentProgram: GlProgram
  private transitionProgram: GlProgram
  private vao: WebGLVertexArrayObject | null = null
  private buffer: WebGLBuffer | null = null
  private fromTarget: Target | null = null
  private toTarget: Target | null = null
  private mediaTextures = new Map<string, MediaTexture>()
  private textTextures = new Map<string, TextTexture>()
  private disposed = false
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) throw new Error('WebGL2 tidak tersedia di browser ini.')
    this.gl = gl
    this.layerProgram = new GlProgram(gl, VERT_LAYER, FRAG_LAYER)
    this.presentProgram = new GlProgram(gl, VERT_FULL, FRAG_PRESENT)
    this.transitionProgram = new GlProgram(gl, VERT_FULL, FRAG_TRANSITION)
    this.setupGeometry()
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.disable(gl.DEPTH_TEST)
    if (document.fonts) {
      void document.fonts.ready.then(() => {
        this.textTextures.forEach((entry) => {
          this.gl.deleteTexture(entry.texture)
        })
        this.textTextures.clear()
      })
    }
  }

  private setupGeometry(): void {
    const gl = this.gl
    const vao = gl.createVertexArray()
    const buffer = gl.createBuffer()
    if (!vao || !buffer) throw new Error('Geometri WebGL gagal dibuat.')
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW,
    )
    const location = gl.getAttribLocation(this.layerProgram.program, 'a_pos')
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    this.vao = vao
    this.buffer = buffer
  }

  private bindFullscreen(): void {
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    const presentLocation = gl.getAttribLocation(this.presentProgram.program, 'a_pos')
    gl.enableVertexAttribArray(presentLocation)
    gl.vertexAttribPointer(presentLocation, 2, gl.FLOAT, false, 0, 0)
    const transitionLocation = gl.getAttribLocation(this.transitionProgram.program, 'a_pos')
    gl.enableVertexAttribArray(transitionLocation)
    gl.vertexAttribPointer(transitionLocation, 2, gl.FLOAT, false, 0, 0)
  }

  private makeTarget(width: number, height: number): Target {
    const gl = this.gl
    const texture = gl.createTexture()
    const fbo = gl.createFramebuffer()
    if (!texture || !fbo) throw new Error('Render target gagal dibuat.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fbo, texture, width, height }
  }

  private ensureTargets(width: number, height: number): void {
    if (this.fromTarget && this.fromTarget.width === width && this.fromTarget.height === height) {
      return
    }
    if (this.fromTarget) {
      this.gl.deleteFramebuffer(this.fromTarget.fbo)
      this.gl.deleteTexture(this.fromTarget.texture)
    }
    if (this.toTarget) {
      this.gl.deleteFramebuffer(this.toTarget.fbo)
      this.gl.deleteTexture(this.toTarget.texture)
    }
    this.fromTarget = this.makeTarget(width, height)
    this.toTarget = this.makeTarget(width, height)
  }

  private getMediaTexture(asset: MediaAsset): MediaTexture | null {
    const gl = this.gl
    let entry = this.mediaTextures.get(asset.id)
    if (!entry) {
      const texture = gl.createTexture()
      if (!texture) return null
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      entry = {
        texture,
        width: asset.width || 16,
        height: asset.height || 9,
        uploaded: false,
      }
      this.mediaTextures.set(asset.id, entry)
    }

    if (asset.kind === 'video') {
      const video = mediaPool.video(asset.id)
      if (!video || video.readyState < 2 || video.videoWidth === 0) return null
      entry.width = video.videoWidth
      entry.height = video.videoHeight
      gl.bindTexture(gl.TEXTURE_2D, entry.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      entry.uploaded = true
      return entry
    }

    if (asset.kind === 'image') {
      const image = mediaPool.image(asset.id)
      if (!image || !image.complete || image.naturalWidth === 0) return null
      if (!entry.uploaded) {
        entry.width = image.naturalWidth
        entry.height = image.naturalHeight
        gl.bindTexture(gl.TEXTURE_2D, entry.texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        entry.uploaded = true
      }
      return entry
    }

    return null
  }

  private getTextTexture(clip: Clip, project: Project): TextTexture | null {
    if (!clip.text) return null
    const gl = this.gl
    const signature = JSON.stringify([clip.text, project.width, project.height])
    const existing = this.textTextures.get(clip.id)
    if (existing?.signature === signature) return existing

    const canvas = existing?.canvas ?? document.createElement('canvas')
    canvas.width = project.width
    canvas.height = project.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const config = clip.text
    const family =
      config.fontFamily === 'IBM Plex Mono'
        ? '"IBM Plex Mono", monospace'
        : '"Archivo Variable", "Archivo", sans-serif'
    ctx.font = `${config.fontWeight} ${config.fontSize}px ${family}`
    ctx.textBaseline = 'alphabetic'
    const maxWidth = Math.max(80, canvas.width * 0.82)
    const lines = wrapText(ctx, config.content || 'Teks baru', maxWidth)
    const lineHeight = config.fontSize * 1.16
    const maxLineWidth = Math.max(
      ...lines.map((line) => ctx.measureText(line || ' ').width),
      1,
    )
    const blockWidth = Math.min(canvas.width - 32, maxLineWidth + config.padding * 2)
    const blockHeight = lineHeight * lines.length + config.padding * 2
    const blockX = (canvas.width - blockWidth) / 2
    const blockY = (canvas.height - blockHeight) / 2

    if (config.backgroundOpacity > 0.001) {
      ctx.fillStyle = withAlpha(config.backgroundColor, config.backgroundOpacity)
      ctx.fillRect(blockX, blockY, blockWidth, blockHeight)
    }

    ctx.textAlign = config.align
    const textX =
      config.align === 'left'
        ? blockX + config.padding
        : config.align === 'right'
          ? blockX + blockWidth - config.padding
          : canvas.width / 2
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.fillStyle = config.color
    ctx.strokeStyle = config.strokeColor
    ctx.lineWidth = config.strokeWidth
    lines.forEach((line, index) => {
      const y = blockY + config.padding + config.fontSize * 0.82 + index * lineHeight
      if (config.strokeWidth > 0) ctx.strokeText(line, textX, y)
      ctx.fillText(line, textX, y)
    })

    let texture = existing?.texture
    if (!texture) {
      texture = gl.createTexture() ?? undefined
      if (!texture) return null
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    } else {
      gl.bindTexture(gl.TEXTURE_2D, texture)
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
    const entry: TextTexture = { texture, canvas, signature }
    this.textTextures.set(clip.id, entry)
    return entry
  }

  private syncVideos(project: Project, time: number, playing: boolean): void {
    for (const clip of project.clips) {
      if (clip.type !== 'video' || !clip.mediaId) continue
      const local = time - clip.start
      if (local < 0 || local >= clip.duration) continue
      const track = project.tracks.find((item) => item.id === clip.trackId)
      if (!track || track.hidden) continue
      const asset = media(project, clip.mediaId)
      const source = Math.min(
        Math.max(0, sourceTimeFor(clip, local)),
        Math.max(0, (asset?.duration ?? 0) - 0.02),
      )
      mediaPool.syncVideo(clip.mediaId, source, playing)
    }
  }

  private drawLayer(
    clip: Clip,
    project: Project,
    time: number,
    target: Target,
    width: number,
    height: number,
  ): boolean {
    const gl = this.gl
    const local = Math.max(0, Math.min(clip.duration, time - clip.start))
    let texture: WebGLTexture | null = null
    let sourceWidth = 0
    let sourceHeight = 0
    let texelWidth = 0
    let texelHeight = 0

    if (clip.type === 'text') {
      const entry = this.getTextTexture(clip, project)
      if (!entry) return false
      texture = entry.texture
      sourceWidth = project.width
      sourceHeight = project.height
      texelWidth = 1 / project.width
      texelHeight = 1 / project.height
    } else {
      if (!clip.mediaId) return false
      const asset = media(project, clip.mediaId)
      if (!asset) return false
      const entry = this.getMediaTexture(asset)
      if (!entry) return false
      texture = entry.texture
      sourceWidth = entry.width
      sourceHeight = entry.height
      texelWidth = 1 / Math.max(1, entry.width)
      texelHeight = 1 / Math.max(1, entry.height)
    }

    const scale = animatedValue(clip, 'scale', local)
    const rotation = (animatedValue(clip, 'rotation', local) * Math.PI) / 180
    const opacity = Math.max(0, Math.min(1, animatedValue(clip, 'opacity', local)))
    if (opacity <= 0.001) return false
    const projectScale = width / project.width
    const base = fitScale(clip.transform.fit, sourceWidth, sourceHeight, width, height)
    const drawWidth = sourceWidth * base * scale
    const drawHeight = sourceHeight * base * scale
    const centerX = width / 2 + animatedValue(clip, 'x', local) * projectScale
    const centerY = height / 2 + animatedValue(clip, 'y', local) * projectScale

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
    gl.viewport(0, 0, width, height)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.bindFullscreen()
    this.layerProgram.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(this.layerProgram.u('u_tex'), 0)
    gl.uniform2f(this.layerProgram.u('u_resolution'), width, height)
    gl.uniform2f(this.layerProgram.u('u_center'), centerX, centerY)
    gl.uniform2f(this.layerProgram.u('u_size'), drawWidth, drawHeight)
    gl.uniform1f(this.layerProgram.u('u_rotation'), rotation)
    gl.uniform2f(this.layerProgram.u('u_texel'), texelWidth, texelHeight)
    gl.uniform1f(this.layerProgram.u('u_time'), time)
    gl.uniform1f(this.layerProgram.u('u_opacity'), opacity)
    const grade: ColorGrade = clip.grade
    gl.uniform1f(this.layerProgram.u('u_exposure'), grade.exposure)
    gl.uniform1f(this.layerProgram.u('u_contrast'), grade.contrast)
    gl.uniform1f(this.layerProgram.u('u_saturation'), grade.saturation)
    gl.uniform1f(this.layerProgram.u('u_temperature'), grade.temperature)
    gl.uniform1f(this.layerProgram.u('u_tint'), grade.tint)
    gl.uniform1f(this.layerProgram.u('u_highlights'), grade.highlights)
    gl.uniform1f(this.layerProgram.u('u_shadows'), grade.shadows)
    gl.uniform1f(this.layerProgram.u('u_vibrance'), grade.vibrance)
    gl.uniform1f(this.layerProgram.u('u_sharpness'), grade.sharpness)
    gl.uniform1f(this.layerProgram.u('u_vignette'), grade.vignette)
    gl.uniform1f(this.layerProgram.u('u_grain'), grade.grain)
    const chroma = clip.chroma
    gl.uniform1f(this.layerProgram.u('u_chromaEnabled'), chroma.enabled ? 1 : 0)
    const [kr, kg, kb] = hexToRgb(chroma.color)
    gl.uniform3f(this.layerProgram.u('u_keyColor'), kr, kg, kb)
    gl.uniform1f(this.layerProgram.u('u_similarity'), chroma.similarity)
    gl.uniform1f(this.layerProgram.u('u_smoothness'), chroma.smoothness)
    gl.uniform1f(this.layerProgram.u('u_spill'), chroma.spill)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return true
  }

  private present(target: Target, width: number, height: number): void {
    const gl = this.gl
    gl.viewport(0, 0, width, height)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    this.bindFullscreen()
    this.presentProgram.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, target.texture)
    gl.uniform1i(this.presentProgram.u('u_tex'), 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  private presentTransition(
    from: Target,
    to: Target,
    clip: Clip,
    progress: number,
    time: number,
    width: number,
    height: number,
  ): void {
    const gl = this.gl
    gl.viewport(0, 0, width, height)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    this.bindFullscreen()
    this.transitionProgram.use()
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, from.texture)
    gl.uniform1i(this.transitionProgram.u('u_from'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, to.texture)
    gl.uniform1i(this.transitionProgram.u('u_to'), 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1f(this.transitionProgram.u('u_progress'), progress)
    gl.uniform1i(
      this.transitionProgram.u('u_type'),
      TRANSITION_CODES[clip.transitionIn?.type ?? 'dissolve'],
    )
    const [dx, dy] = directionVector(clip)
    gl.uniform2f(this.transitionProgram.u('u_dir'), dx, dy)
    gl.uniform1f(this.transitionProgram.u('u_time'), time)
    gl.uniform2f(
      this.transitionProgram.u('u_texel'),
      1 / Math.max(1, width),
      1 / Math.max(1, height),
    )
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  render(project: Project, time: number, playing = false): void {
    if (this.disposed) return
    const gl = this.gl
    const width = this.canvas.width
    const height = this.canvas.height
    if (width === 0 || height === 0) return
    this.ensureTargets(width, height)
    this.syncVideos(project, time, playing)
    const [br, bg, bb] = hexToRgb(project.background)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, width, height)
    gl.disable(gl.BLEND)
    gl.clearColor(br, bg, bb, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const tracks = visualTracks(project)
    for (const track of tracks) {
      const active = activeClipsOnTrack(project, track.id, time)
      if (active.length === 0) continue
      const consumed = new Set<string>()
      const transitions = active.filter((item) => {
        if (!item.transitionIn || !this.fromTarget || !this.toTarget) return false
        const end = item.start + item.transitionIn.duration
        if (time < item.start || time >= end) return false
        return active.some((other) => other.id !== item.id && other.start < item.start)
      })

      for (const incoming of transitions) {
        const previous = active
          .filter((item) => item.id !== incoming.id && item.start < incoming.start)
          .sort((a, b) => clipEnd(b) - clipEnd(a))[0]
        if (!previous || !this.fromTarget || !this.toTarget) continue
        const progress =
          (time - incoming.start) / Math.max(0.001, incoming.transitionIn?.duration ?? 1)
        const hasFrom = this.drawLayer(previous, project, time, this.fromTarget, width, height)
        const hasTo = this.drawLayer(incoming, project, time, this.toTarget, width, height)
        if (hasFrom && hasTo) {
          consumed.add(previous.id)
          consumed.add(incoming.id)
          this.presentTransition(
            this.fromTarget,
            this.toTarget,
            incoming,
            Math.max(0, Math.min(1, progress)),
            time,
            width,
            height,
          )
        }
      }

      for (const clip of active) {
        if (consumed.has(clip.id) || !this.toTarget) continue
        if (this.drawLayer(clip, project, time, this.toTarget, width, height)) {
          this.present(this.toTarget, width, height)
        }
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.disable(gl.BLEND)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    for (const entry of this.mediaTextures.values()) gl.deleteTexture(entry.texture)
    for (const entry of this.textTextures.values()) gl.deleteTexture(entry.texture)
    if (this.fromTarget) {
      gl.deleteFramebuffer(this.fromTarget.fbo)
      gl.deleteTexture(this.fromTarget.texture)
    }
    if (this.toTarget) {
      gl.deleteFramebuffer(this.toTarget.fbo)
      gl.deleteTexture(this.toTarget.texture)
    }
    if (this.vao) gl.deleteVertexArray(this.vao)
    if (this.buffer) gl.deleteBuffer(this.buffer)
    gl.deleteProgram(this.layerProgram.program)
    gl.deleteProgram(this.presentProgram.program)
    gl.deleteProgram(this.transitionProgram.program)
    this.mediaTextures.clear()
    this.textTextures.clear()
  }
}
