import type { Project } from '../editor/types'
import { STYLE_PACKS } from '../editor/presets'
import type { Translate, TranslationKey } from '../i18n'
import type { AgentAction } from './schema'

const actionKeys: Record<AgentAction['type'], TranslationKey> = {
  add_text: 'ai.action.addText',
  update_text: 'ai.action.updateText',
  move_clip: 'ai.action.moveClip',
  trim_clip: 'ai.action.trimClip',
  split_clip: 'ai.action.splitClip',
  delete_clip: 'ai.action.deleteClip',
  duplicate_clip: 'ai.action.duplicateClip',
  set_filter: 'ai.action.setFilter',
  set_color_grade: 'ai.action.setColorGrade',
  set_transform: 'ai.action.setTransform',
  set_chroma: 'ai.action.setChroma',
  set_transition: 'ai.action.setTransition',
  set_speed: 'ai.action.setSpeed',
  set_audio: 'ai.action.setAudio',
  add_keyframe: 'ai.action.addKeyframe',
  apply_style_pack: 'ai.action.applyStyle',
  add_track: 'ai.action.addTrack',
  set_project_settings: 'ai.action.projectSettings',
}

const propertyKeys: Record<Extract<AgentAction, { type: 'add_keyframe' }>['property'], TranslationKey> = {
  x: 'property.x',
  y: 'property.y',
  scale: 'property.scale',
  rotation: 'property.rotation',
  opacity: 'property.opacity',
  volume: 'property.volume',
}

const seconds = (value: number): string => `${Number(value.toFixed(1))}s`

export const actionLabel = (action: AgentAction, t: Translate): string => t(actionKeys[action.type])

export const describeAction = (
  action: AgentAction,
  project: Project,
  t: Translate,
): string => {
  const clipName = (id: string): string =>
    project.clips.find((item) => item.id === id)?.name ?? id.slice(0, 8)

  switch (action.type) {
    case 'add_text':
      return `"${action.content}" · ${seconds(action.start)} + ${seconds(action.duration)}`
    case 'update_text':
      return `${clipName(action.clipId)}${action.content ? ` · "${action.content}"` : ''}`
    case 'move_clip':
      return `${clipName(action.clipId)} → ${seconds(action.start)}`
    case 'trim_clip': {
      const parts = [clipName(action.clipId)]
      if (action.start !== undefined) parts.push(`start ${seconds(action.start)}`)
      if (action.duration !== undefined) parts.push(`duration ${seconds(action.duration)}`)
      return parts.join(' · ')
    }
    case 'split_clip':
      return `${clipName(action.clipId)} @ ${seconds(action.at)}`
    case 'delete_clip':
    case 'duplicate_clip':
      return clipName(action.clipId)
    case 'set_filter':
      return `${clipName(action.clipId)} · ${action.filterId}`
    case 'set_color_grade':
      return clipName(action.clipId)
    case 'set_transform':
      return clipName(action.clipId)
    case 'set_chroma':
      return clipName(action.clipId)
    case 'set_transition':
      return `${clipName(action.clipId)} · ${action.transition ?? t('ai.action.removeTransition')}`
    case 'set_speed':
      return `${clipName(action.clipId)} · ${action.speed}x`
    case 'set_audio':
      return clipName(action.clipId)
    case 'add_keyframe':
      return `${clipName(action.clipId)} · ${t(propertyKeys[action.property])} @ ${seconds(action.time)}`
    case 'apply_style_pack': {
      const style = STYLE_PACKS.find((item) => item.id === action.styleId)
      return `${clipName(action.clipId)} · ${style ? t(style.nameKey) : action.styleId}`
    }
    case 'add_track':
      return t(`trackKind.${action.kind}`)
    case 'set_project_settings': {
      const parts: string[] = []
      if (action.aspect) parts.push(action.aspect)
      if (action.fps) parts.push(`${action.fps} fps`)
      if (action.background) parts.push(action.background)
      if (action.name) parts.push(action.name)
      return parts.join(' · ')
    }
    default:
      return ''
  }
}
