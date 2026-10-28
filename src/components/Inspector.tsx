import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { useT, type TranslationKey } from '../i18n'
import { useEditorStore } from '../editor/store'
import {
  aspectFromDimensions,
  DEFAULT_GRADE,
  DEFAULT_TEXT,
  defaultTextContent,
} from '../editor/defaults'
import {
  ANIMATED_PROPERTIES,
  EASING_PRESETS,
  animatedValue,
  keyframeAt,
  propertyLabel,
  propertyRange,
  propertyUnit,
  type TextAnimationPreset,
} from '../editor/keyframes'
import { FILTER_PRESETS, TRANSITION_PRESETS, filterName } from '../editor/presets'
import {
  clipEnd,
  formatShortTime,
  media,
  previousClip,
  projectDuration,
  sourceDuration,
} from '../editor/timelineMath'
import type { AnimatedProperty, Clip, InspectorTab, TransitionType } from '../editor/types'
import { Icon, type IconName } from './Icon'
import {
  ColorField,
  NumberField,
  RangeField,
  Section,
  Segmented,
  SelectField,
  Toggle,
} from './controls'

const tabMeta: Record<InspectorTab, { labelKey: TranslationKey; icon: IconName }> = {
  clip: { labelKey: 'inspector.tab.clip', icon: 'settings' },
  color: { labelKey: 'inspector.tab.color', icon: 'sparkle' },
  chroma: { labelKey: 'inspector.tab.chroma', icon: 'eyedropper' },
  motion: { labelKey: 'inspector.tab.motion', icon: 'keyframe' },
  audio: { labelKey: 'inspector.tab.audio', icon: 'volume' },
  speed: { labelKey: 'inspector.tab.speed', icon: 'forward' },
  text: { labelKey: 'inspector.tab.text', icon: 'text' },
}

const clipTypeKey: Record<Clip['type'], TranslationKey> = {
  video: 'clipType.video',
  audio: 'clipType.audio',
  image: 'clipType.image',
  text: 'clipType.text',
}

const tabsForClip = (clip: Clip | undefined): InspectorTab[] => {
  if (!clip) return []
  if (clip.type === 'text') return ['text', 'motion', 'clip']
  if (clip.type === 'audio') return ['audio', 'speed', 'clip']
  if (clip.type === 'image') return ['clip', 'color', 'chroma', 'motion']
  return ['clip', 'color', 'chroma', 'motion', 'audio', 'speed']
}

const formatSeconds = (value: number): string => {
  const fixed = Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2)
  return `${fixed.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')}s`
}

const getLocal = (clip: Clip, playhead: number): number =>
  Math.max(0, Math.min(clip.duration, playhead - clip.start))

const ProjectPanel = (): ReactNode => {
  const t = useT()
  const project = useEditorStore((state) => state.project)
  const setAspect = useEditorStore((state) => state.setAspect)
  const setProjectSettings = useEditorStore((state) => state.setProjectSettings)
  const addTextClip = useEditorStore((state) => state.addTextClip)
  const clearTimeline = useEditorStore((state) => state.clearTimeline)
  const aspect = aspectFromDimensions(project.width, project.height)
  const duration = projectDuration(project)

  return (
    <div className="inspector-body">
      <div className="inspector-hero">
        <span className="eyebrow">{t('inspector.project')}</span>
        <h2>{project.name}</h2>
        <p>
          {t('inspector.projectStats', {
            clips: project.clips.length,
            media: project.media.length,
            duration: formatShortTime(duration),
          })}
        </p>
      </div>

      <Section title={t('inspector.format')} note={t('inspector.formatNote')}>
        <Segmented
          label={t('inspector.ratio')}
          value={aspect}
          options={[
            { value: '16:9', label: '16:9' },
            { value: '9:16', label: '9:16' },
            { value: '1:1', label: '1:1' },
            { value: '4:5', label: '4:5' },
          ]}
          onChange={(value) => {
            if (value === '16:9' || value === '9:16' || value === '1:1' || value === '4:5') {
              setAspect(value)
            }
          }}
        />
        <SelectField
          label={t('inspector.frameRate')}
          value={String(project.fps)}
          options={[
            { value: '24', label: '24 fps' },
            { value: '30', label: '30 fps' },
            { value: '60', label: '60 fps' },
          ]}
          onChange={(value) => setProjectSettings({ fps: Number(value) })}
        />
        <ColorField
          label={t('inspector.canvasBackground')}
          value={project.background}
          onChange={(value) => setProjectSettings({ background: value })}
        />
        <div className="stat-grid">
          <div>
            <span>{t('inspector.resolution')}</span>
            <strong>
              {project.width} × {project.height}
            </strong>
          </div>
          <div>
            <span>{t('inspector.duration')}</span>
            <strong>{formatShortTime(duration)}</strong>
          </div>
        </div>
      </Section>

      <div className="inspector-actions">
        <button type="button" className="button" onClick={() => addTextClip(t('common.newText'))}>
          <Icon name="text" size={15} />
          {t('inspector.addText')}
        </button>
        <button
          type="button"
          className="button danger"
          onClick={() => {
            if (window.confirm(t('inspector.clearConfirm'))) {
              clearTimeline()
            }
          }}
        >
          <Icon name="trash" size={15} />
          {t('inspector.clear')}
        </button>
      </div>
    </div>
  )
}

const TransitionEditor = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const project = useEditorStore((state) => state.project)
  const addTransition = useEditorStore((state) => state.addTransition)
  const removeTransition = useEditorStore((state) => state.removeTransition)
  const setTransitionType = useEditorStore((state) => state.setTransitionType)
  const previous = previousClip(project, clip)
  const [type, setType] = useState(clip.transitionIn?.type ?? 'dissolve')

  if (!previous) {
    return (
      <Section title={t('inspector.transitionIn')} note={t('inspector.transitionNeedsPrev')}>
        <p className="hint-copy">{t('inspector.transitionPlace')}</p>
      </Section>
    )
  }

  return (
    <Section
      title={t('inspector.transitionIn')}
      note={t('inspector.transitionFrom', {
        name: previous.name,
        duration: formatSeconds(previous.duration),
      })}
      action={
        clip.transitionIn ? (
          <button
            type="button"
            className="text-button danger"
            onClick={() => removeTransition(clip.id)}
          >
            {t('common.remove')}
          </button>
        ) : undefined
      }
    >
      <SelectField
        label={t('inspector.type')}
        value={clip.transitionIn?.type ?? type}
        options={TRANSITION_PRESETS.map((item) => ({ value: item.type, label: t(item.nameKey) }))}
        onChange={(value) => {
          const next = value as TransitionType
          setType(next)
          if (clip.transitionIn) setTransitionType(clip.id, next)
        }}
      />
      <RangeField
        label={t('inspector.transitionDuration')}
        value={clip.transitionIn?.duration ?? Math.min(0.5, clip.duration * 0.4)}
        min={0.12}
        max={Math.min(1.2, clip.duration * 0.45, previous.duration * 0.45)}
        step={0.01}
        format={formatSeconds}
        onChange={(value) => addTransition(clip.id, clip.transitionIn?.type ?? type, value)}
      />
      {!clip.transitionIn ? (
        <button
          type="button"
          className="wide-button"
          onClick={() => addTransition(clip.id, type)}
        >
          <Icon name="plus" size={15} />
          {t('inspector.applyTransition')}
        </button>
      ) : null}
    </Section>
  )
}

const ClipPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const playhead = useEditorStore((state) => state.playhead)
  const updateClip = useEditorStore((state) => state.updateClip)
  const updateTransform = useEditorStore((state) => state.updateTransform)
  const setPropertyValue = useEditorStore((state) => state.setPropertyValue)
  const setClipStart = useEditorStore((state) => state.setClipStart)
  const setClipDuration = useEditorStore((state) => state.setClipDuration)
  const duplicateClip = useEditorStore((state) => state.duplicateClip)
  const splitClip = useEditorStore((state) => state.splitClip)
  const deleteClip = useEditorStore((state) => state.deleteClip)
  const local = getLocal(clip, playhead)

  return (
    <div className="inspector-body">
      <div className="clip-heading">
        <span className={clsx('clip-type-badge', `type-${clip.type}`)}>{t(clipTypeKey[clip.type])}</span>
        <input
          className="clip-name-input"
          value={clip.name}
          aria-label={t('inspector.clipName')}
          onChange={(event) =>
            updateClip(clip.id, { name: event.target.value }, { coalesceKey: `clip-name-${clip.id}` })
          }
        />
        <span className="clip-heading-time">{formatShortTime(clip.duration)}</span>
      </div>

      <Section title={t('inspector.time')} note={t('inspector.timeNote')}>
        <div className="field-grid two">
          <NumberField
            label={t('inspector.start')}
            value={clip.start}
            min={0}
            step={0.05}
            suffix="s"
            onChange={(value) => setClipStart(clip.id, value)}
          />
          <NumberField
            label={t('inspector.duration')}
            value={clip.duration}
            min={0.1}
            step={0.05}
            suffix="s"
            onChange={(value) => setClipDuration(clip.id, value)}
          />
        </div>
        <div className="clip-range-note">
          <span>{t('inspector.in')} {formatSeconds(clip.sourceIn)}</span>
          <span>{t('inspector.out')} {formatSeconds(clip.sourceOut)}</span>
          <span>{t('inspector.end')} {formatSeconds(clipEnd(clip))}</span>
        </div>
      </Section>

      <Section
        title={t('inspector.transform')}
        note={t('inspector.transformNote')}
        action={
          <button
            type="button"
            className="text-button"
            onClick={() =>
              updateTransform(clip.id, {
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0,
                opacity: 1,
                fit: 'contain',
              })
            }
          >
            {t('common.reset')}
          </button>
        }
      >
        <SelectField
          label={t('inspector.fit')}
          value={clip.transform.fit}
          options={[
            { value: 'contain', label: t('inspector.contain') },
            { value: 'cover', label: t('inspector.cover') },
          ]}
          onChange={(value) =>
            updateTransform(clip.id, { fit: value === 'cover' ? 'cover' : 'contain' })
          }
        />
        <RangeField
          label={t('inspector.positionX')}
          value={animatedValue(clip, 'x', local)}
          min={-1400}
          max={1400}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => setPropertyValue(clip.id, 'x', value)}
        />
        <RangeField
          label={t('inspector.positionY')}
          value={animatedValue(clip, 'y', local)}
          min={-1000}
          max={1000}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => setPropertyValue(clip.id, 'y', value)}
        />
        <RangeField
          label={t('inspector.scale')}
          value={animatedValue(clip, 'scale', local)}
          min={0.05}
          max={4}
          step={0.01}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(value) => setPropertyValue(clip.id, 'scale', value)}
        />
        <RangeField
          label={t('inspector.rotation')}
          value={animatedValue(clip, 'rotation', local)}
          min={-360}
          max={360}
          step={1}
          format={(value) => `${Math.round(value)}°`}
          onChange={(value) => setPropertyValue(clip.id, 'rotation', value)}
        />
        <RangeField
          label={t('inspector.opacity')}
          value={animatedValue(clip, 'opacity', local)}
          min={0}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => setPropertyValue(clip.id, 'opacity', value)}
        />
      </Section>

      <TransitionEditor clip={clip} />

      <div className="inspector-actions">
        <button type="button" className="button" onClick={() => duplicateClip(clip.id)}>
          <Icon name="copy" size={15} />
          {t('inspector.duplicate')}
        </button>
        <button type="button" className="button" onClick={splitClip}>
          <Icon name="scissors" size={15} />
          {t('inspector.split')}
        </button>
        <button type="button" className="button danger" onClick={() => deleteClip(clip.id)}>
          <Icon name="trash" size={15} />
          {t('common.delete')}
        </button>
      </div>
    </div>
  )
}

const ColorPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const updateGrade = useEditorStore((state) => state.updateGrade)
  const applyFilter = useEditorStore((state) => state.applyFilter)
  const grade = clip.grade

  const field = (
    key: keyof typeof grade,
    label: string,
    min: number,
    max: number,
    step = 0.01,
  ): ReactNode => (
    <RangeField
      key={key}
      label={label}
      value={grade[key]}
      min={min}
      max={max}
      step={step}
      format={(value) => value.toFixed(2)}
      onChange={(value) => updateGrade(clip.id, { [key]: value })}
    />
  )

  return (
    <div className="inspector-body">
      <Section
        title={t('inspector.filter')}
        note={filterName(clip.filterId)}
        action={
          <button
            type="button"
            className="text-button"
            onClick={() => updateGrade(clip.id, { ...DEFAULT_GRADE })}
          >
            {t('common.reset')}
          </button>
        }
      >
        <div className="inspector-filter-grid">
          {FILTER_PRESETS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={clsx('filter-chip', clip.filterId === filter.id && 'is-active')}
              onClick={() => applyFilter(clip.id, filter.id)}
            >
              <span className="filter-dots">
                {filter.swatch.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <span>{t(filter.nameKey)}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title={t('inspector.light')} note={t('inspector.lightNote')}>
        {field('exposure', t('inspector.exposure'), -0.5, 0.5)}
        {field('contrast', t('inspector.contrast'), -1, 1)}
        {field('highlights', t('inspector.highlights'), -1, 1)}
        {field('shadows', t('inspector.shadows'), -1, 1)}
      </Section>

      <Section title={t('inspector.color')} note={t('inspector.colorNote')}>
        {field('temperature', t('inspector.temperature'), -1, 1)}
        {field('tint', t('inspector.tint'), -1, 1)}
        {field('saturation', t('inspector.saturation'), -1, 1)}
        {field('vibrance', t('inspector.vibrance'), -1, 1)}
      </Section>

      <Section title={t('inspector.texture')} note={t('inspector.textureNote')}>
        {field('sharpness', t('inspector.sharpness'), 0, 1)}
        {field('vignette', t('inspector.vignette'), 0, 1)}
        {field('grain', t('inspector.grain'), 0, 1)}
      </Section>
    </div>
  )
}

const ChromaPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const updateChroma = useEditorStore((state) => state.updateChroma)
  const setEyedropper = useEditorStore((state) => state.setEyedropper)
  const eyedropper = useEditorStore((state) => state.eyedropper)
  const chroma = clip.chroma

  return (
    <div className="inspector-body">
      <Section title={t('inspector.chroma')} note={t('inspector.chromaNote')}>
        <Toggle
          label={t('inspector.chromaEnable')}
          note={t('inspector.chromaEnableNote')}
          checked={chroma.enabled}
          onChange={(value) => updateChroma(clip.id, { enabled: value })}
        />
        <ColorField
          label={t('inspector.keyColor')}
          value={chroma.color}
          onChange={(value) => updateChroma(clip.id, { color: value })}
        />
        <button
          type="button"
          className={clsx('wide-button', eyedropper && 'is-active')}
          onClick={() => setEyedropper(!eyedropper)}
        >
          <Icon name="eyedropper" size={15} />
          {eyedropper ? t('inspector.pickPreviewActive') : t('inspector.pickPreview')}
        </button>
        <RangeField
          label={t('inspector.similarity')}
          value={chroma.similarity}
          min={0.01}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => updateChroma(clip.id, { similarity: value })}
        />
        <RangeField
          label={t('inspector.smoothness')}
          value={chroma.smoothness}
          min={0}
          max={0.5}
          step={0.005}
          format={(value) => value.toFixed(3)}
          onChange={(value) => updateChroma(clip.id, { smoothness: value })}
        />
        <RangeField
          label={t('inspector.spill')}
          value={chroma.spill}
          min={0}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => updateChroma(clip.id, { spill: value })}
        />
      </Section>
      <div className="note-card">
        <Icon name="alert" size={18} />
        <p>{t('inspector.chromaHelp')}</p>
      </div>
    </div>
  )
}

const TextAnimationButtons = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const applyTextAnimation = useEditorStore((state) => state.applyTextAnimation)
  const presets: { id: TextAnimationPreset; labelKey: TranslationKey }[] = [
    { id: 'fade', labelKey: 'textAnimation.fade' },
    { id: 'slide', labelKey: 'textAnimation.rise' },
    { id: 'pop', labelKey: 'textAnimation.pop' },
    { id: 'zoom', labelKey: 'textAnimation.zoom' },
  ]
  return (
    <div className="animation-grid">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="animation-chip"
          onClick={() => applyTextAnimation(clip.id, preset.id)}
        >
          <span className={`animation-mark anim-${preset.id}`} />
          {t(preset.labelKey)}
        </button>
      ))}
    </div>
  )
}

const MotionPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const playhead = useEditorStore((state) => state.playhead)
  const setPlayhead = useEditorStore((state) => state.setPlayhead)
  const addKeyframe = useEditorStore((state) => state.addKeyframe)
  const removeKeyframe = useEditorStore((state) => state.removeKeyframe)
  const setKeyframeEasing = useEditorStore((state) => state.setKeyframeEasing)
  const setPropertyValue = useEditorStore((state) => state.setPropertyValue)
  const [property, setProperty] = useState<AnimatedProperty>('scale')
  const local = getLocal(clip, playhead)
  const range = propertyRange(property)
  const list = clip.keyframes[property] ?? []
  const current = animatedValue(clip, property, local)
  const atPlayhead = keyframeAt(list, local)
  const easingMatch = (easing: [number, number, number, number]): string =>
    EASING_PRESETS.find((preset) => preset.easing.every((value, index) => value === easing[index]))
      ?.id ?? 'smooth'

  return (
    <div className="inspector-body">
      {clip.type === 'text' ? (
        <Section title={t('inspector.textAnimation')} note={t('inspector.textAnimationNote')}>
          <TextAnimationButtons clip={clip} />
        </Section>
      ) : null}

      <Section title={t('inspector.keyframes')} note={t('inspector.keyframesNote')}>
        <div className="motion-properties">
          {ANIMATED_PROPERTIES.filter(
            (item) => item !== 'volume' || clip.type === 'video' || clip.type === 'audio',
          ).map((item) => (
            <button
              key={item}
              type="button"
              className={clsx(property === item && 'is-active')}
              onClick={() => setProperty(item)}
            >
              {propertyLabel(item)}
            </button>
          ))}
        </div>

        <div className="keyframe-current">
          <div>
            <span className="eyebrow">{t('inspector.currentValue')}</span>
            <strong>
              {current.toFixed(property === 'opacity' ? 2 : property === 'x' || property === 'y' ? 0 : 2)}
              {propertyUnit(property)}
            </strong>
          </div>
          <button
            type="button"
            className={clsx('keyframe-toggle', atPlayhead && 'is-active')}
            aria-label={atPlayhead ? t('inspector.removeKeyframeAt') : t('inspector.addKeyframeAt')}
            title={atPlayhead ? t('inspector.removeKeyframe') : t('inspector.addKeyframe')}
            onClick={() => {
              if (atPlayhead) removeKeyframe(clip.id, property, atPlayhead.id)
              else addKeyframe(clip.id, property)
            }}
          >
            <Icon name="keyframe" size={18} />
          </button>
        </div>

        <RangeField
          label={propertyLabel(property)}
          value={current}
          min={range.min}
          max={range.max}
          step={range.step}
          format={(value) =>
            property === 'opacity'
              ? `${Math.round(value * 100)}%`
              : `${value.toFixed(property === 'rotation' ? 0 : 2)}${propertyUnit(property)}`
          }
          onChange={(value) => setPropertyValue(clip.id, property, value)}
        />

        <div className="keyframe-list">
          {list.length === 0 ? (
            <p className="hint-copy">{t('inspector.noKeyframes')}</p>
          ) : (
            [...list]
              .sort((a, b) => a.time - b.time)
              .map((keyframe) => (
                <div
                  className={clsx('keyframe-row', atPlayhead?.id === keyframe.id && 'is-active')}
                  key={keyframe.id}
                >
                  <button
                    type="button"
                    className="keyframe-time"
                    onClick={() => setPlayhead(clip.start + keyframe.time)}
                  >
                    <Icon name="keyframe" size={12} />
                    {formatSeconds(keyframe.time)}
                  </button>
                  <span className="keyframe-value">{keyframe.value.toFixed(2)}</span>
                  <select
                    aria-label={t('inspector.keyframeEasing')}
                    value={easingMatch(keyframe.easing)}
                    onChange={(event) => {
                      const preset = EASING_PRESETS.find((item) => item.id === event.target.value)
                      if (preset) setKeyframeEasing(clip.id, property, keyframe.id, preset.easing)
                    }}
                  >
                    {EASING_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {t(preset.nameKey)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn tiny danger-hover"
                    aria-label={t('inspector.removeKeyframe')}
                    onClick={() => removeKeyframe(clip.id, property, keyframe.id)}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))
          )}
        </div>
      </Section>
    </div>
  )
}

const AudioPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const project = useEditorStore((state) => state.project)
  const playhead = useEditorStore((state) => state.playhead)
  const setPropertyValue = useEditorStore((state) => state.setPropertyValue)
  const toggleMute = useEditorStore((state) => state.toggleMute)
  const setFade = useEditorStore((state) => state.setFade)
  const detachAudio = useEditorStore((state) => state.detachAudio)
  const asset = media(project, clip.mediaId)
  const local = getLocal(clip, playhead)
  const canDetach = clip.type === 'video' && asset?.hasAudio && !clip.muted
  const bars = asset?.waveform?.length
    ? asset.waveform
    : Array.from({ length: 48 }, (_, index) => 0.2 + ((index * 11) % 19) / 24)

  return (
    <div className="inspector-body">
      <Section title={t('inspector.audioLevel')} note={clip.name}>
        <div className="wave audio-wave">
          {bars.map((value, index) => (
            <span key={index} style={{ height: `${Math.round(value * 100)}%` }} />
          ))}
        </div>
        <Toggle
          label={t('inspector.muteClip')}
          checked={clip.muted}
          onChange={() => toggleMute(clip.id)}
        />
        <RangeField
          label={t('inspector.volume')}
          value={animatedValue(clip, 'volume', local)}
          min={0}
          max={2}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => setPropertyValue(clip.id, 'volume', value)}
        />
        <RangeField
          label={t('inspector.fadeIn')}
          value={clip.fadeIn}
          min={0}
          max={Math.max(0.1, clip.duration / 2)}
          step={0.01}
          format={formatSeconds}
          onChange={(value) => setFade(clip.id, 'in', value)}
        />
        <RangeField
          label={t('inspector.fadeOut')}
          value={clip.fadeOut}
          min={0}
          max={Math.max(0.1, clip.duration / 2)}
          step={0.01}
          format={formatSeconds}
          onChange={(value) => setFade(clip.id, 'out', value)}
        />
        {canDetach ? (
          <button type="button" className="wide-button" onClick={() => detachAudio(clip.id)}>
            <Icon name="audio" size={15} />
            {t('inspector.detachAudio')}
          </button>
        ) : null}
      </Section>
      {clip.type === 'video' && clip.muted ? (
        <div className="note-card">
          <Icon name="volume" size={18} />
          <p>{t('inspector.mutedNote')}</p>
        </div>
      ) : null}
    </div>
  )
}

const SpeedPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const setSpeed = useEditorStore((state) => state.setSpeed)
  const setPreservePitch = useEditorStore((state) => state.setPreservePitch)
  const source = sourceDuration(clip)
  return (
    <div className="inspector-body">
      <Section title={t('inspector.speed')} note={t('inspector.speedNote')}>
        <Segmented
          label={t('inspector.preset')}
          value={String(clip.speed)}
          options={[
            { value: '0.5', label: '0.5×' },
            { value: '1', label: '1×' },
            { value: '1.5', label: '1.5×' },
            { value: '2', label: '2×' },
            { value: '4', label: '4×' },
          ]}
          onChange={(value) => setSpeed(clip.id, Number(value))}
        />
        <RangeField
          label={t('inspector.speed')}
          value={clip.speed}
          min={0.25}
          max={4}
          step={0.01}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(value) => setSpeed(clip.id, value)}
        />
        <Toggle
          label={t('inspector.keepPitch')}
          note={t('inspector.keepPitchNote')}
          checked={clip.preservePitch}
          onChange={(value) => setPreservePitch(clip.id, value)}
        />
        <div className="stat-grid">
          <div>
            <span>{t('inspector.source')}</span>
            <strong>{formatSeconds(source)}</strong>
          </div>
          <div>
            <span>{t('inspector.result')}</span>
            <strong>{formatSeconds(clip.duration)}</strong>
          </div>
        </div>
      </Section>
    </div>
  )
}

const TextPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const t = useT()
  const updateText = useEditorStore((state) => state.updateText)
  const text = clip.text ?? DEFAULT_TEXT
  return (
    <div className="inspector-body">
      <Section
        title={t('inspector.textContent')}
        note={t('inspector.textContentNote')}
        action={
          <button
            type="button"
            className="text-button"
            onClick={() => updateText(clip.id, { ...DEFAULT_TEXT, content: defaultTextContent() })}
          >
            {t('common.reset')}
          </button>
        }
      >
        <textarea
          className="text-area"
          value={text.content}
          rows={3}
          aria-label={t('inspector.textContent')}
          onChange={(event) => updateText(clip.id, { content: event.target.value })}
        />
        <SelectField
          label={t('inspector.font')}
          value={text.fontFamily}
          options={[
            { value: 'Archivo Variable', label: 'Archivo' },
            { value: 'IBM Plex Mono', label: 'IBM Plex Mono' },
          ]}
          onChange={(value) =>
            updateText(clip.id, {
              fontFamily: value === 'IBM Plex Mono' ? 'IBM Plex Mono' : 'Archivo Variable',
            })
          }
        />
        <div className="field-grid two">
          <NumberField
            label={t('inspector.size')}
            value={text.fontSize}
            min={12}
            max={360}
            step={1}
            onChange={(value) => updateText(clip.id, { fontSize: value })}
          />
          <SelectField
            label={t('inspector.weight')}
            value={String(text.fontWeight)}
            options={[
              { value: '400', label: t('inspector.weightRegular') },
              { value: '500', label: t('inspector.weightMedium') },
              { value: '600', label: t('inspector.weightSemibold') },
              { value: '700', label: t('inspector.weightBold') },
            ]}
            onChange={(value) => updateText(clip.id, { fontWeight: Number(value) })}
          />
        </div>
        <Segmented
          label={t('inspector.align')}
          value={text.align}
          options={[
            { value: 'left', label: t('inspector.left') },
            { value: 'center', label: t('inspector.center') },
            { value: 'right', label: t('inspector.right') },
          ]}
          onChange={(value) => updateText(clip.id, { align: value })}
        />
      </Section>

      <Section title={t('inspector.colorAndBackground')}>
        <ColorField
          label={t('inspector.textColor')}
          value={text.color}
          onChange={(value) => updateText(clip.id, { color: value })}
        />
        <ColorField
          label={t('inspector.strokeColor')}
          value={text.strokeColor}
          onChange={(value) => updateText(clip.id, { strokeColor: value })}
        />
        <RangeField
          label={t('inspector.strokeWidth')}
          value={text.strokeWidth}
          min={0}
          max={24}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => updateText(clip.id, { strokeWidth: value })}
        />
        <ColorField
          label={t('inspector.backgroundColor')}
          value={text.backgroundColor}
          onChange={(value) => updateText(clip.id, { backgroundColor: value })}
        />
        <RangeField
          label={t('inspector.backgroundOpacity')}
          value={text.backgroundOpacity}
          min={0}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => updateText(clip.id, { backgroundOpacity: value })}
        />
        <RangeField
          label={t('inspector.padding')}
          value={text.padding}
          min={0}
          max={96}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => updateText(clip.id, { padding: value })}
        />
      </Section>

      <Section title={t('inspector.animation')} note={t('inspector.animationNote')}>
        <TextAnimationButtons clip={clip} />
      </Section>
    </div>
  )
}

export const Inspector = (): ReactNode => {
  const t = useT()
  const selectedClip = useEditorStore((state) =>
    state.project.clips.find((item) => item.id === state.selectedClipId),
  )
  const inspectorTab = useEditorStore((state) => state.inspectorTab)
  const setInspectorTab = useEditorStore((state) => state.setInspectorTab)
  const mobilePanel = useEditorStore((state) => state.mobilePanel)
  const setMobilePanel = useEditorStore((state) => state.setMobilePanel)
  const tabs = tabsForClip(selectedClip)
  const activeTab = tabs.includes(inspectorTab) ? inspectorTab : tabs[0]

  useEffect(() => {
    if (selectedClip && tabs.length > 0 && !tabs.includes(inspectorTab)) {
      setInspectorTab(tabs[0])
    }
  }, [selectedClip, inspectorTab, setInspectorTab, tabs])

  return (
    <aside className={clsx('inspector', mobilePanel === 'right' && 'is-mobile-open')}>
      <div className="inspector-head">
        <div>
          <span className="eyebrow">{t('inspector.eyebrow')}</span>
          <strong>{selectedClip ? selectedClip.name : t('inspector.projectSettings')}</strong>
        </div>
        <button
          type="button"
          className="icon-btn mobile-close"
          aria-label={t('inspector.close')}
          onClick={() => setMobilePanel(null)}
        >
          <Icon name="close" size={17} />
        </button>
      </div>

      {selectedClip ? (
        <div className="tabs inspector-tabs" role="tablist" aria-label={t('inspector.clipSettings')}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={clsx('tab', activeTab === tab && 'is-active')}
              onClick={() => setInspectorTab(tab)}
            >
              <Icon name={tabMeta[tab].icon} size={14} />
              {t(tabMeta[tab].labelKey)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="inspector-scroll">
        {!selectedClip ? <ProjectPanel /> : null}
        {selectedClip && activeTab === 'clip' ? <ClipPanel clip={selectedClip} /> : null}
        {selectedClip && activeTab === 'color' ? <ColorPanel clip={selectedClip} /> : null}
        {selectedClip && activeTab === 'chroma' ? <ChromaPanel clip={selectedClip} /> : null}
        {selectedClip && activeTab === 'motion' ? <MotionPanel clip={selectedClip} /> : null}
        {selectedClip && activeTab === 'audio' ? <AudioPanel clip={selectedClip} /> : null}
        {selectedClip && activeTab === 'speed' ? <SpeedPanel clip={selectedClip} /> : null}
        {selectedClip && activeTab === 'text' ? <TextPanel clip={selectedClip} /> : null}
      </div>
    </aside>
  )
}
