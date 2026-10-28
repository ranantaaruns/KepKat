import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { useEditorStore } from '../editor/store'
import { aspectFromDimensions, DEFAULT_GRADE, DEFAULT_TEXT } from '../editor/defaults'
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

const tabMeta: Record<InspectorTab, { label: string; icon: IconName }> = {
  clip: { label: 'Klip', icon: 'settings' },
  color: { label: 'Warna', icon: 'sparkle' },
  chroma: { label: 'Chroma', icon: 'eyedropper' },
  motion: { label: 'Gerak', icon: 'keyframe' },
  audio: { label: 'Audio', icon: 'volume' },
  speed: { label: 'Kecepatan', icon: 'forward' },
  text: { label: 'Teks', icon: 'text' },
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
        <span className="eyebrow">Proyek</span>
        <h2>{project.name}</h2>
        <p>
          {project.clips.length} klip · {project.media.length} media · {formatShortTime(duration)}
        </p>
      </div>

      <Section title="Format" note="Rasio dan laju bingkai proyek.">
        <Segmented
          label="Rasio"
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
          label="Frame rate"
          value={String(project.fps)}
          options={[
            { value: '24', label: '24 fps' },
            { value: '30', label: '30 fps' },
            { value: '60', label: '60 fps' },
          ]}
          onChange={(value) => setProjectSettings({ fps: Number(value) })}
        />
        <ColorField
          label="Latar kanvas"
          value={project.background}
          onChange={(value) => setProjectSettings({ background: value })}
        />
        <div className="stat-grid">
          <div>
            <span>Resolusi</span>
            <strong>
              {project.width} × {project.height}
            </strong>
          </div>
          <div>
            <span>Durasi</span>
            <strong>{formatShortTime(duration)}</strong>
          </div>
        </div>
      </Section>

      <div className="inspector-actions">
        <button type="button" className="button" onClick={() => addTextClip('Teks baru')}>
          <Icon name="text" size={15} />
          Tambah teks
        </button>
        <button
          type="button"
          className="button danger"
          onClick={() => {
            if (window.confirm('Kosongkan seluruh timeline dan media? Tindakan ini bisa diurungkan.')) {
              clearTimeline()
            }
          }}
        >
          <Icon name="trash" size={15} />
          Kosongkan
        </button>
      </div>
    </div>
  )
}

const TransitionEditor = ({ clip }: { clip: Clip }): ReactNode => {
  const project = useEditorStore((state) => state.project)
  const addTransition = useEditorStore((state) => state.addTransition)
  const removeTransition = useEditorStore((state) => state.removeTransition)
  const setTransitionType = useEditorStore((state) => state.setTransitionType)
  const previous = previousClip(project, clip)
  const [type, setType] = useState(clip.transitionIn?.type ?? 'dissolve')

  if (!previous) {
    return (
      <Section title="Transisi masuk" note="Butuh klip sebelumnya di track yang sama.">
        <p className="hint-copy">
          Letakkan klip ini setelah klip lain, lalu kembali ke sini untuk membuat transisi.
        </p>
      </Section>
    )
  }

  return (
    <Section
      title="Transisi masuk"
      note={`Dari ${previous.name} · ${formatSeconds(previous.duration)}`}
      action={
        clip.transitionIn ? (
          <button
            type="button"
            className="text-button danger"
            onClick={() => removeTransition(clip.id)}
          >
            Hapus
          </button>
        ) : undefined
      }
    >
      <SelectField
        label="Jenis"
        value={clip.transitionIn?.type ?? type}
        options={TRANSITION_PRESETS.map((item) => ({ value: item.type, label: item.name }))}
        onChange={(value) => {
          const next = value as TransitionType
          setType(next)
          if (clip.transitionIn) setTransitionType(clip.id, next)
        }}
      />
      <RangeField
        label="Durasi transisi"
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
          Terapkan transisi
        </button>
      ) : null}
    </Section>
  )
}

const ClipPanel = ({ clip }: { clip: Clip }): ReactNode => {
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
        <span className={clsx('clip-type-badge', `type-${clip.type}`)}>{clip.type}</span>
        <input
          className="clip-name-input"
          value={clip.name}
          aria-label="Nama klip"
          onChange={(event) =>
            updateClip(clip.id, { name: event.target.value }, { coalesceKey: `clip-name-${clip.id}` })
          }
        />
        <span className="clip-heading-time">{formatShortTime(clip.duration)}</span>
      </div>

      <Section title="Waktu" note="Atur posisi dan durasi klip.">
        <div className="field-grid two">
          <NumberField
            label="Mulai"
            value={clip.start}
            min={0}
            step={0.05}
            suffix="s"
            onChange={(value) => setClipStart(clip.id, value)}
          />
          <NumberField
            label="Durasi"
            value={clip.duration}
            min={0.1}
            step={0.05}
            suffix="s"
            onChange={(value) => setClipDuration(clip.id, value)}
          />
        </div>
        <div className="clip-range-note">
          <span>Masuk {formatSeconds(clip.sourceIn)}</span>
          <span>Keluar {formatSeconds(clip.sourceOut)}</span>
          <span>Selesai {formatSeconds(clipEnd(clip))}</span>
        </div>
      </Section>

      <Section
        title="Transformasi"
        note="Nilai diambil dari playhead saat ini."
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
            Reset
          </button>
        }
      >
        <SelectField
          label="Penyesuaian"
          value={clip.transform.fit}
          options={[
            { value: 'contain', label: 'Muat di dalam' },
            { value: 'cover', label: 'Isi penuh' },
          ]}
          onChange={(value) =>
            updateTransform(clip.id, { fit: value === 'cover' ? 'cover' : 'contain' })
          }
        />
        <RangeField
          label="Posisi X"
          value={animatedValue(clip, 'x', local)}
          min={-1400}
          max={1400}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => setPropertyValue(clip.id, 'x', value)}
        />
        <RangeField
          label="Posisi Y"
          value={animatedValue(clip, 'y', local)}
          min={-1000}
          max={1000}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => setPropertyValue(clip.id, 'y', value)}
        />
        <RangeField
          label="Skala"
          value={animatedValue(clip, 'scale', local)}
          min={0.05}
          max={4}
          step={0.01}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(value) => setPropertyValue(clip.id, 'scale', value)}
        />
        <RangeField
          label="Rotasi"
          value={animatedValue(clip, 'rotation', local)}
          min={-360}
          max={360}
          step={1}
          format={(value) => `${Math.round(value)}°`}
          onChange={(value) => setPropertyValue(clip.id, 'rotation', value)}
        />
        <RangeField
          label="Opacity"
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
          Duplikat
        </button>
        <button type="button" className="button" onClick={splitClip}>
          <Icon name="scissors" size={15} />
          Pisah
        </button>
        <button type="button" className="button danger" onClick={() => deleteClip(clip.id)}>
          <Icon name="trash" size={15} />
          Hapus
        </button>
      </div>
    </div>
  )
}

const ColorPanel = ({ clip }: { clip: Clip }): ReactNode => {
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
        title="Filter"
        note={filterName(clip.filterId)}
        action={
          <button
            type="button"
            className="text-button"
            onClick={() => updateGrade(clip.id, { ...DEFAULT_GRADE })}
          >
            Reset
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
              <span>{filter.name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Cahaya" note="Eksposur dan kontras.">
        {field('exposure', 'Eksposur', -0.5, 0.5)}
        {field('contrast', 'Kontras', -1, 1)}
        {field('highlights', 'Highlight', -1, 1)}
        {field('shadows', 'Shadow', -1, 1)}
      </Section>

      <Section title="Warna" note="Suhu, tint, dan saturasi.">
        {field('temperature', 'Suhu', -1, 1)}
        {field('tint', 'Tint', -1, 1)}
        {field('saturation', 'Saturasi', -1, 1)}
        {field('vibrance', 'Vibrance', -1, 1)}
      </Section>

      <Section title="Tekstur" note="Detail dan karakter gambar.">
        {field('sharpness', 'Ketajaman', 0, 1)}
        {field('vignette', 'Vignette', 0, 1)}
        {field('grain', 'Grain', 0, 1)}
      </Section>
    </div>
  )
}

const ChromaPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const updateChroma = useEditorStore((state) => state.updateChroma)
  const setEyedropper = useEditorStore((state) => state.setEyedropper)
  const eyedropper = useEditorStore((state) => state.eyedropper)
  const chroma = clip.chroma

  return (
    <div className="inspector-body">
      <Section title="Chroma key" note="Hapus warna latar dari klip.">
        <Toggle
          label="Aktifkan chroma key"
          note="Cocok untuk layar hijau atau biru."
          checked={chroma.enabled}
          onChange={(value) => updateChroma(clip.id, { enabled: value })}
        />
        <ColorField
          label="Warna kunci"
          value={chroma.color}
          onChange={(value) => updateChroma(clip.id, { color: value })}
        />
        <button
          type="button"
          className={clsx('wide-button', eyedropper && 'is-active')}
          onClick={() => setEyedropper(!eyedropper)}
        >
          <Icon name="eyedropper" size={15} />
          {eyedropper ? 'Klik warna di pratinjau' : 'Ambil warna dari pratinjau'}
        </button>
        <RangeField
          label="Kemiripan"
          value={chroma.similarity}
          min={0.01}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => updateChroma(clip.id, { similarity: value })}
        />
        <RangeField
          label="Kelembutan"
          value={chroma.smoothness}
          min={0}
          max={0.5}
          step={0.005}
          format={(value) => value.toFixed(3)}
          onChange={(value) => updateChroma(clip.id, { smoothness: value })}
        />
        <RangeField
          label="Kurangi spill"
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
        <p>
          Chroma key bekerja berdasarkan jarak warna RGB. Untuk hasil terbaik, gunakan latar
          dengan pencahayaan rata dan warna yang jauh dari warna kulit.
        </p>
      </div>
    </div>
  )
}

const TextAnimationButtons = ({ clip }: { clip: Clip }): ReactNode => {
  const applyTextAnimation = useEditorStore((state) => state.applyTextAnimation)
  const presets: { id: TextAnimationPreset; label: string }[] = [
    { id: 'fade', label: 'Fade' },
    { id: 'slide', label: 'Naik' },
    { id: 'pop', label: 'Pop' },
    { id: 'zoom', label: 'Zoom' },
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
          {preset.label}
        </button>
      ))}
    </div>
  )
}

const MotionPanel = ({ clip }: { clip: Clip }): ReactNode => {
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
        <Section title="Animasi teks" note="Preset cepat untuk teks masuk.">
          <TextAnimationButtons clip={clip} />
        </Section>
      ) : null}

      <Section title="Keyframe" note="Animasi properti sepanjang klip.">
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
            <span className="eyebrow">Nilai saat ini</span>
            <strong>
              {current.toFixed(property === 'opacity' ? 2 : property === 'x' || property === 'y' ? 0 : 2)}
              {propertyUnit(property)}
            </strong>
          </div>
          <button
            type="button"
            className={clsx('keyframe-toggle', atPlayhead && 'is-active')}
            aria-label={atPlayhead ? 'Hapus keyframe di playhead' : 'Tambah keyframe di playhead'}
            title={atPlayhead ? 'Hapus keyframe' : 'Tambah keyframe'}
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
            <p className="hint-copy">Belum ada keyframe. Tekan ikon berlian untuk menambah.</p>
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
                    aria-label="Easing keyframe"
                    value={easingMatch(keyframe.easing)}
                    onChange={(event) => {
                      const preset = EASING_PRESETS.find((item) => item.id === event.target.value)
                      if (preset) setKeyframeEasing(clip.id, property, keyframe.id, preset.easing)
                    }}
                  >
                    {EASING_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn tiny danger-hover"
                    aria-label="Hapus keyframe"
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
      <Section title="Level audio" note={clip.name}>
        <div className="wave audio-wave">
          {bars.map((value, index) => (
            <span key={index} style={{ height: `${Math.round(value * 100)}%` }} />
          ))}
        </div>
        <Toggle
          label="Bisukan klip"
          checked={clip.muted}
          onChange={() => toggleMute(clip.id)}
        />
        <RangeField
          label="Volume"
          value={animatedValue(clip, 'volume', local)}
          min={0}
          max={2}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => setPropertyValue(clip.id, 'volume', value)}
        />
        <RangeField
          label="Fade masuk"
          value={clip.fadeIn}
          min={0}
          max={Math.max(0.1, clip.duration / 2)}
          step={0.01}
          format={formatSeconds}
          onChange={(value) => setFade(clip.id, 'in', value)}
        />
        <RangeField
          label="Fade keluar"
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
            Pisahkan audio dari video
          </button>
        ) : null}
      </Section>
      {clip.type === 'video' && clip.muted ? (
        <div className="note-card">
          <Icon name="volume" size={18} />
          <p>Audio video ini dibisukan. Gunakan tombol di atas untuk mengaktifkan kembali.</p>
        </div>
      ) : null}
    </div>
  )
}

const SpeedPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const setSpeed = useEditorStore((state) => state.setSpeed)
  const setPreservePitch = useEditorStore((state) => state.setPreservePitch)
  const source = sourceDuration(clip)
  return (
    <div className="inspector-body">
      <Section title="Kecepatan" note="Ubah tempo tanpa memotong klip.">
        <Segmented
          label="Preset"
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
          label="Kecepatan"
          value={clip.speed}
          min={0.25}
          max={4}
          step={0.01}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(value) => setSpeed(clip.id, value)}
        />
        <Toggle
          label="Pertahankan nada"
          note="Kurangi perubahan pitch saat audio dipercepat."
          checked={clip.preservePitch}
          onChange={(value) => setPreservePitch(clip.id, value)}
        />
        <div className="stat-grid">
          <div>
            <span>Sumber</span>
            <strong>{formatSeconds(source)}</strong>
          </div>
          <div>
            <span>Hasil</span>
            <strong>{formatSeconds(clip.duration)}</strong>
          </div>
        </div>
      </Section>
    </div>
  )
}

const TextPanel = ({ clip }: { clip: Clip }): ReactNode => {
  const updateText = useEditorStore((state) => state.updateText)
  const text = clip.text ?? DEFAULT_TEXT
  return (
    <div className="inspector-body">
      <Section
        title="Isi teks"
        note="Teks mendukung beberapa baris."
        action={
          <button
            type="button"
            className="text-button"
            onClick={() => updateText(clip.id, { ...DEFAULT_TEXT })}
          >
            Reset
          </button>
        }
      >
        <textarea
          className="text-area"
          value={text.content}
          rows={3}
          aria-label="Isi teks"
          onChange={(event) => updateText(clip.id, { content: event.target.value })}
        />
        <SelectField
          label="Font"
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
            label="Ukuran"
            value={text.fontSize}
            min={12}
            max={360}
            step={1}
            onChange={(value) => updateText(clip.id, { fontSize: value })}
          />
          <SelectField
            label="Bobot"
            value={String(text.fontWeight)}
            options={[
              { value: '400', label: 'Regular' },
              { value: '500', label: 'Medium' },
              { value: '600', label: 'Semibold' },
              { value: '700', label: 'Bold' },
            ]}
            onChange={(value) => updateText(clip.id, { fontWeight: Number(value) })}
          />
        </div>
        <Segmented
          label="Perataan"
          value={text.align}
          options={[
            { value: 'left', label: 'Kiri' },
            { value: 'center', label: 'Tengah' },
            { value: 'right', label: 'Kanan' },
          ]}
          onChange={(value) => updateText(clip.id, { align: value })}
        />
      </Section>

      <Section title="Warna dan latar">
        <ColorField
          label="Warna teks"
          value={text.color}
          onChange={(value) => updateText(clip.id, { color: value })}
        />
        <ColorField
          label="Warna garis"
          value={text.strokeColor}
          onChange={(value) => updateText(clip.id, { strokeColor: value })}
        />
        <RangeField
          label="Tebal garis"
          value={text.strokeWidth}
          min={0}
          max={24}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => updateText(clip.id, { strokeWidth: value })}
        />
        <ColorField
          label="Warna latar"
          value={text.backgroundColor}
          onChange={(value) => updateText(clip.id, { backgroundColor: value })}
        />
        <RangeField
          label="Opacity latar"
          value={text.backgroundOpacity}
          min={0}
          max={1}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => updateText(clip.id, { backgroundOpacity: value })}
        />
        <RangeField
          label="Padding"
          value={text.padding}
          min={0}
          max={96}
          step={1}
          format={(value) => `${Math.round(value)} px`}
          onChange={(value) => updateText(clip.id, { padding: value })}
        />
      </Section>

      <Section title="Animasi" note="Terapkan gerak masuk cepat.">
        <TextAnimationButtons clip={clip} />
      </Section>
    </div>
  )
}

export const Inspector = (): ReactNode => {
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
          <span className="eyebrow">Inspektur</span>
          <strong>{selectedClip ? selectedClip.name : 'Pengaturan proyek'}</strong>
        </div>
        <button
          type="button"
          className="icon-btn mobile-close"
          aria-label="Tutup inspektur"
          onClick={() => setMobilePanel(null)}
        >
          <Icon name="close" size={17} />
        </button>
      </div>

      {selectedClip ? (
        <div className="tabs inspector-tabs" role="tablist" aria-label="Pengaturan klip">
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
              {tabMeta[tab].label}
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
