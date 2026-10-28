import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { useEditorStore } from '../editor/store'
import { FILTER_PRESETS, STYLE_PACKS, TRANSITION_PRESETS } from '../editor/presets'
import { formatDuration } from '../services/media'
import { Icon } from './Icon'

interface LeftPanelProps {
  onImportFiles: (files: File[]) => void
  importing: boolean
  importLabel: string
  onRemoveMedia: (assetId: string) => void
}

const panelTabs = [
  { id: 'media', label: 'Media', icon: 'folder' as const },
  { id: 'preset', label: 'Preset', icon: 'sparkle' as const },
  { id: 'text', label: 'Teks', icon: 'text' as const },
] as const

const TextPresetButton = ({
  label,
  sample,
  patch,
  onAdd,
}: {
  label: string
  sample: string
  patch: Record<string, unknown>
  onAdd: (content: string, patch: Record<string, unknown>) => void
}): ReactNode => (
  <button className="text-preset" type="button" onClick={() => onAdd(sample, patch)}>
    <span className="text-preset-sample">{sample}</span>
    <span className="text-preset-label">
      {label}
      <Icon name="plus" size={13} />
    </span>
  </button>
)

export const LeftPanel = ({
  onImportFiles,
  importing,
  importLabel,
  onRemoveMedia,
}: LeftPanelProps): ReactNode => {
  const leftPanel = useEditorStore((state) => state.leftPanel)
  const setLeftPanel = useEditorStore((state) => state.setLeftPanel)
  const media = useEditorStore((state) => state.project.media)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  const selectedClip = useEditorStore((state) =>
    state.project.clips.find((item) => item.id === state.selectedClipId),
  )
  const addClipFromMedia = useEditorStore((state) => state.addClipFromMedia)
  const addTextClip = useEditorStore((state) => state.addTextClip)
  const updateText = useEditorStore((state) => state.updateText)
  const applyFilter = useEditorStore((state) => state.applyFilter)
  const applyStylePack = useEditorStore((state) => state.applyStylePack)
  const addTransition = useEditorStore((state) => state.addTransition)
  const mobilePanel = useEditorStore((state) => state.mobilePanel)
  const setMobilePanel = useEditorStore((state) => state.setMobilePanel)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const pickFiles = (): void => inputRef.current?.click()

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length) onImportFiles(files)
  }

  const addTextPreset = (content: string, patch: Record<string, unknown>): void => {
    addTextClip(content)
    const id = useEditorStore.getState().selectedClipId
    if (id) updateText(id, patch as Parameters<typeof updateText>[1])
  }

  const closeMobile = (): void => setMobilePanel(null)
  const targetTitle = selectedClip ? selectedClip.name : 'Pilih klip di timeline'

  return (
    <aside className={clsx('left-panel', mobilePanel === 'left' && 'is-mobile-open')}>
      <div className="panel-head">
        <div className="tabs" role="tablist" aria-label="Panel kiri">
          {panelTabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={leftPanel === tab.id}
              className={clsx('tab', leftPanel === tab.id && 'is-active')}
              onClick={() => setLeftPanel(tab.id)}
            >
              <Icon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>
        <button className="icon-btn mobile-close" type="button" onClick={closeMobile} aria-label="Tutup panel">
          <Icon name="close" size={17} />
        </button>
      </div>

      <div
        className="panel-scroll"
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return
          setDragging(false)
        }}
        onDrop={handleDrop}
      >
        {leftPanel === 'media' ? (
          <div className="panel-section">
            <input
              ref={inputRef}
              type="file"
              accept="video/*,audio/*,image/*"
              multiple
              hidden
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.length) onImportFiles(files)
                event.target.value = ''
              }}
            />
            <button
              type="button"
              className={clsx('dropzone', dragging && 'is-dragging')}
              onClick={pickFiles}
            >
              <span className="dropzone-icon">
                <Icon name={importing ? 'sparkle' : 'upload'} size={22} />
              </span>
              <strong>{importing ? importLabel : 'Impor media'}</strong>
              <span>{importing ? 'Menyiapkan berkas…' : 'Tarik file ke sini atau pilih dari perangkat'}</span>
              <em>Video, audio, dan gambar · diproses lokal</em>
            </button>

            <div className="panel-row">
              <span className="eyebrow">Pustaka</span>
              <span className="count-chip">{media.length}</span>
            </div>

            {media.length === 0 ? (
              <div className="mini-empty">
                <Icon name="folder" size={22} />
                <p>Belum ada media.</p>
                <span>Impor video, musik, atau gambar untuk mulai menyusun.</span>
              </div>
            ) : (
              <div className="media-list">
                {media.map((asset) => (
                  <article className="media-card" key={asset.id}>
                    <div className="media-thumb">
                      {asset.thumbnail ? (
                        <img src={asset.thumbnail} alt="" />
                      ) : asset.kind === 'audio' ? (
                        <div className="wave mini-wave">
                          {(asset.waveform?.length ? asset.waveform : Array.from({ length: 26 }, (_, i) => 0.25 + ((i * 7) % 11) / 18)).map(
                            (value, index) => (
                              <span key={index} style={{ height: `${Math.round(value * 100)}%` }} />
                            ),
                          )}
                        </div>
                      ) : (
                        <Icon name={asset.kind === 'video' ? 'video' : 'image'} size={24} />
                      )}
                      <span className="media-duration">
                        {asset.kind === 'image' ? 'GAMBAR' : formatDuration(asset.duration)}
                      </span>
                    </div>
                    <div className="media-info">
                      <strong title={asset.name}>{asset.name}</strong>
                      <span>
                        {asset.kind === 'video' ? 'Video' : asset.kind === 'audio' ? 'Audio' : 'Gambar'}
                        {asset.width > 0 ? ` · ${asset.width}×${asset.height}` : ''}
                      </span>
                    </div>
                    <div className="media-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Tambah ${asset.name} ke timeline`}
                        onClick={() => addClipFromMedia(asset.id)}
                      >
                        <Icon name="plus" size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger-hover"
                        aria-label={`Hapus ${asset.name}`}
                        onClick={() => onRemoveMedia(asset.id)}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {leftPanel === 'preset' ? (
          <div className="panel-section">
            <div className="panel-intro">
              <span className="eyebrow">Gaya cepat</span>
              <p>{selectedClip ? targetTitle : 'Pilih klip dulu, lalu terapkan gaya.'}</p>
            </div>
            <div className="style-grid">
              {STYLE_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  className="style-card"
                  disabled={!selectedClip}
                  onClick={() => {
                    if (!selectedClipId) return
                    applyStylePack(selectedClipId, pack.filterId, pack.transition)
                  }}
                >
                  <span className="style-swatch">
                    {FILTER_PRESETS.find((item) => item.id === pack.filterId)?.swatch.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <strong>{pack.name}</strong>
                  <span>{pack.note}</span>
                </button>
              ))}
            </div>

            <div className="panel-row">
              <span className="eyebrow">Filter</span>
              <span className="hint-inline">warna & tekstur</span>
            </div>
            <div className="filter-grid">
              {FILTER_PRESETS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={clsx('filter-chip', selectedClip?.filterId === filter.id && 'is-active')}
                  disabled={!selectedClip}
                  onClick={() => selectedClipId && applyFilter(selectedClipId, filter.id)}
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

            <div className="panel-row">
              <span className="eyebrow">Transisi</span>
              <span className="hint-inline">masuk</span>
            </div>
            <div className="transition-grid">
              {TRANSITION_PRESETS.map((transition) => (
                <button
                  key={transition.type}
                  type="button"
                  className="transition-chip"
                  disabled={!selectedClip}
                  title={transition.note}
                  onClick={() => selectedClipId && addTransition(selectedClipId, transition.type)}
                >
                  <span className={`transition-mark type-${transition.type}`} />
                  <span>{transition.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {leftPanel === 'text' ? (
          <div className="panel-section">
            <div className="panel-intro">
              <span className="eyebrow">Teks</span>
              <p>Tambahkan judul atau keterangan. Semua teks bisa dianimasikan di panel kanan.</p>
            </div>
            <div className="text-preset-grid">
              <TextPresetButton
                label="Judul"
                sample="Buka cerita"
                patch={{ fontSize: 112, fontWeight: 700, align: 'center' }}
                onAdd={addTextPreset}
              />
              <TextPresetButton
                label="Subjudul"
                sample="Detail kecil"
                patch={{ fontSize: 58, fontWeight: 500, align: 'center', color: '#d6d0c7' }}
                onAdd={addTextPreset}
              />
              <TextPresetButton
                label="Caption"
                sample="CATATAN 01"
                patch={{
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 38,
                  fontWeight: 500,
                  align: 'left',
                  color: '#f0ede6',
                }}
                onAdd={addTextPreset}
              />
              <TextPresetButton
                label="Kutipan"
                sample="“Sedikit lebih pelan.”"
                patch={{ fontSize: 72, fontWeight: 400, align: 'center', color: '#ffd9c9' }}
                onAdd={addTextPreset}
              />
            </div>

            <button className="wide-button" type="button" onClick={() => addTextClip('Teks baru')}>
              <Icon name="plus" size={16} />
              Teks kosong
            </button>

            <div className="note-card">
              <Icon name="sparkle" size={18} />
              <p>
                Teks dirender langsung di kanvas. Gunakan tab <strong>Gerak</strong> untuk keyframe
                dan animasi masuk.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
