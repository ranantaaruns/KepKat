import { z } from 'zod'
import { FILTER_PRESETS, STYLE_PACKS, TRANSITION_PRESETS } from '../editor/presets'

const filterIds = FILTER_PRESETS.map((item) => item.id) as [string, ...string[]]
const transitionIds = TRANSITION_PRESETS.map((item) => item.type) as [string, ...string[]]
const styleIds = STYLE_PACKS.map((item) => item.id) as [string, ...string[]]

const filterId = z.enum(filterIds).describe('A filter preset id from the project snapshot.')
const transitionType = z.enum(transitionIds).describe('A transition preset id.')
const styleId = z.enum(styleIds).describe('A quick style preset id.')

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .describe('A six digit hex color, for example #ff6a3d.')

const textStyle = z.object({
  fontFamily: z.enum(['Archivo Variable', 'IBM Plex Mono']).optional(),
  fontSize: z.number().min(8).max(400).optional(),
  fontWeight: z.number().min(100).max(900).optional(),
  color: hexColor.optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  strokeColor: hexColor.optional(),
  strokeWidth: z.number().min(0).max(24).optional(),
  backgroundColor: hexColor.optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  padding: z.number().min(0).max(160).optional(),
})

const gradePatch = z.object({
  exposure: z.number().min(-0.5).max(0.5).optional(),
  contrast: z.number().min(-1).max(1).optional(),
  saturation: z.number().min(-1).max(1).optional(),
  temperature: z.number().min(-1).max(1).optional(),
  tint: z.number().min(-1).max(1).optional(),
  highlights: z.number().min(-1).max(1).optional(),
  shadows: z.number().min(-1).max(1).optional(),
  vibrance: z.number().min(-1).max(1).optional(),
  sharpness: z.number().min(0).max(1).optional(),
  vignette: z.number().min(0).max(1).optional(),
  grain: z.number().min(0).max(1).optional(),
})

const transformPatch = z.object({
  x: z.number().min(-1920).max(1920).optional(),
  y: z.number().min(-1920).max(1920).optional(),
  scale: z.number().min(0.05).max(4).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  opacity: z.number().min(0).max(1).optional(),
  fit: z.enum(['contain', 'cover']).optional(),
})

const chromaPatch = z.object({
  enabled: z.boolean().optional(),
  color: hexColor.optional(),
  similarity: z.number().min(0).max(1).optional(),
  smoothness: z.number().min(0).max(1).optional(),
  spill: z.number().min(0).max(1).optional(),
  matte: z.boolean().optional(),
})

const clipTarget = z.string().min(1).max(120).describe('An existing clip id from the snapshot.')

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_text'),
    trackId: z.string().min(1).max(120).optional().describe('A text track id. Defaults to the first text track.'),
    start: z.number().min(0).max(86400).describe('Timeline start in seconds.'),
    duration: z.number().min(0.1).max(60).describe('Text clip duration in seconds.'),
    content: z.string().min(1).max(240).describe('The text to render.'),
    style: textStyle.optional(),
    animation: z.enum(['fade', 'slide', 'pop', 'zoom']).optional(),
  }),
  z.object({
    type: z.literal('update_text'),
    clipId: clipTarget,
    content: z.string().min(1).max(240).optional(),
    style: textStyle.optional(),
  }),
  z.object({
    type: z.literal('move_clip'),
    clipId: clipTarget,
    start: z.number().min(0).max(86400).describe('New timeline start in seconds.'),
  }),
  z.object({
    type: z.literal('trim_clip'),
    clipId: clipTarget,
    start: z.number().min(0).max(86400).optional().describe('New timeline start in seconds.'),
    duration: z.number().min(0.1).max(3600).optional().describe('New clip duration in seconds.'),
  }),
  z.object({
    type: z.literal('split_clip'),
    clipId: clipTarget,
    at: z.number().min(0).max(86400).describe('Absolute timeline time in seconds where the clip is split.'),
  }),
  z.object({
    type: z.literal('delete_clip'),
    clipId: clipTarget,
  }),
  z.object({
    type: z.literal('duplicate_clip'),
    clipId: clipTarget,
  }),
  z.object({
    type: z.literal('set_filter'),
    clipId: clipTarget,
    filterId,
  }),
  z.object({
    type: z.literal('set_color_grade'),
    clipId: clipTarget,
    grade: gradePatch,
  }),
  z.object({
    type: z.literal('set_transform'),
    clipId: clipTarget,
    transform: transformPatch,
  }),
  z.object({
    type: z.literal('set_chroma'),
    clipId: clipTarget,
    chroma: chromaPatch,
  }),
  z.object({
    type: z.literal('set_transition'),
    clipId: clipTarget,
    transition: transitionType.nullable().describe('Use null to remove the entrance transition.'),
    duration: z.number().min(0.12).max(1.2).optional(),
  }),
  z.object({
    type: z.literal('set_speed'),
    clipId: clipTarget,
    speed: z.number().min(0.25).max(4),
    preservePitch: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('set_audio'),
    clipId: clipTarget,
    volume: z.number().min(0).max(2).optional(),
    muted: z.boolean().optional(),
    fadeIn: z.number().min(0).max(30).optional(),
    fadeOut: z.number().min(0).max(30).optional(),
  }),
  z.object({
    type: z.literal('add_keyframe'),
    clipId: clipTarget,
    property: z.enum(['x', 'y', 'scale', 'rotation', 'opacity', 'volume']),
    time: z.number().min(0).max(3600).describe('Time inside the clip in seconds.'),
    value: z.number().min(-1920).max(1920),
    easing: z.enum(['linear', 'smooth', 'in', 'out', 'snap']).optional(),
  }),
  z.object({
    type: z.literal('apply_style_pack'),
    clipId: clipTarget,
    styleId,
  }),
  z.object({
    type: z.literal('add_track'),
    kind: z.enum(['overlay', 'text', 'audio']),
  }),
  z.object({
    type: z.literal('set_project_settings'),
    aspect: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
    fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).optional(),
    background: hexColor.optional(),
    name: z.string().min(1).max(80).optional(),
  }),
])

export const agentPlanSchema = z.object({
  title: z.string().min(1).max(80).describe('A short plan title in the user language.'),
  summary: z.string().min(1).max(600).describe('A concise description of what will change.'),
  actions: z.array(actionSchema).min(1).max(25),
})

const easingSchema = z.tuple([z.number(), z.number(), z.number(), z.number()])

const snapshotKeyframeSchema = z.object({
  id: z.string().max(120),
  time: z.number(),
  value: z.number(),
  easing: easingSchema,
})

const snapshotKeyframesSchema = z.object({
  x: z.array(snapshotKeyframeSchema).max(16).optional(),
  y: z.array(snapshotKeyframeSchema).max(16).optional(),
  scale: z.array(snapshotKeyframeSchema).max(16).optional(),
  rotation: z.array(snapshotKeyframeSchema).max(16).optional(),
  opacity: z.array(snapshotKeyframeSchema).max(16).optional(),
  volume: z.array(snapshotKeyframeSchema).max(16).optional(),
})

const snapshotGradeSchema = z.object({
  exposure: z.number(),
  contrast: z.number(),
  saturation: z.number(),
  temperature: z.number(),
  tint: z.number(),
  highlights: z.number(),
  shadows: z.number(),
  vibrance: z.number(),
  sharpness: z.number(),
  vignette: z.number(),
  grain: z.number(),
})

const snapshotTransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number(),
  rotation: z.number(),
  opacity: z.number(),
  fit: z.enum(['contain', 'cover']),
})

const snapshotChromaSchema = z.object({
  enabled: z.boolean(),
  color: z.string(),
  similarity: z.number(),
  smoothness: z.number(),
  spill: z.number(),
  matte: z.boolean(),
})

const snapshotTextSchema = z.object({
  content: z.string().max(2000),
  fontFamily: z.enum(['Archivo Variable', 'IBM Plex Mono']),
  fontSize: z.number(),
  fontWeight: z.number(),
  color: z.string(),
  align: z.enum(['left', 'center', 'right']),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  backgroundColor: z.string(),
  backgroundOpacity: z.number(),
  padding: z.number(),
})

const snapshotTransitionSchema = z.object({
  type: z.string(),
  duration: z.number(),
  direction: z.enum(['left', 'right', 'up', 'down']),
})

const snapshotClipSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  type: z.enum(['video', 'image', 'audio', 'text']),
  mediaId: z.string().optional(),
  name: z.string().max(160),
  start: z.number(),
  duration: z.number(),
  sourceIn: z.number(),
  sourceOut: z.number(),
  speed: z.number(),
  preservePitch: z.boolean(),
  volume: z.number(),
  fadeIn: z.number(),
  fadeOut: z.number(),
  muted: z.boolean(),
  filterId: z.string(),
  transform: snapshotTransformSchema,
  grade: snapshotGradeSchema,
  chroma: snapshotChromaSchema,
  keyframes: snapshotKeyframesSchema,
  transitionIn: snapshotTransitionSchema.optional(),
  text: snapshotTextSchema.optional(),
})

const snapshotTrackSchema = z.object({
  id: z.string(),
  name: z.string().max(120),
  kind: z.enum(['video', 'overlay', 'text', 'audio']),
  muted: z.boolean(),
  hidden: z.boolean(),
  locked: z.boolean(),
  volume: z.number(),
})

const snapshotMediaSchema = z.object({
  id: z.string(),
  name: z.string().max(160),
  kind: z.enum(['video', 'audio', 'image']),
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  hasAudio: z.boolean(),
})

export const projectSnapshotSchema = z.object({
  project: z.object({
    name: z.string().max(80),
    width: z.number(),
    height: z.number(),
    fps: z.number(),
    background: z.string(),
    updatedAt: z.number(),
    duration: z.number(),
  }),
  tracks: z.array(snapshotTrackSchema).max(30),
  media: z.array(snapshotMediaSchema).max(60),
  clips: z.array(snapshotClipSchema).max(120),
  selectedClipId: z.string().nullable(),
  playhead: z.number(),
})

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
})

export const aiChatRequestSchema = z.object({
  mode: z.enum(['confirm', 'plan']),
  messages: z.array(chatMessageSchema).min(1).max(12),
  snapshot: projectSnapshotSchema,
  turnstileToken: z.string().max(4096).optional(),
})

export type AgentAction = z.infer<typeof actionSchema>
export type AgentPlan = z.infer<typeof agentPlanSchema>
export type ProjectSnapshot = z.infer<typeof projectSnapshotSchema>
export type AiChatMessage = z.infer<typeof chatMessageSchema>
export type AiChatRequest = z.infer<typeof aiChatRequestSchema>
export type AiMode = AiChatRequest['mode']

export const agentPlanToolSchema = (() => {
  const schema = z.toJSONSchema(agentPlanSchema, { io: 'input' })
  const { $schema: _schema, ...rest } = schema
  return rest
})()
