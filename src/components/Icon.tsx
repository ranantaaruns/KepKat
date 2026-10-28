import type { ReactNode } from 'react'

export type IconName =
  | 'play'
  | 'pause'
  | 'back'
  | 'forward'
  | 'scissors'
  | 'trash'
  | 'copy'
  | 'undo'
  | 'redo'
  | 'plus'
  | 'upload'
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'volume'
  | 'mute'
  | 'eye'
  | 'eyeOff'
  | 'lock'
  | 'unlock'
  | 'magnet'
  | 'zoomIn'
  | 'zoomOut'
  | 'settings'
  | 'export'
  | 'close'
  | 'chevronDown'
  | 'check'
  | 'keyframe'
  | 'eyedropper'
  | 'rotate'
  | 'fit'
  | 'layers'
  | 'sparkle'
  | 'alert'
  | 'folder'
  | 'more'

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

const paths: Record<IconName, ReactNode> = {
  play: <path d="M8 5.5 18.5 12 8 18.5Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7" y="5" width="3.4" height="14" rx="0.8" fill="currentColor" stroke="none" />
      <rect x="13.6" y="5" width="3.4" height="14" rx="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  back: (
    <>
      <path d="M6 5v14" />
      <path d="m18 6-8 6 8 6Z" fill="currentColor" stroke="none" />
    </>
  ),
  forward: (
    <>
      <path d="M18 5v14" />
      <path d="m6 6 8 6-8 6Z" fill="currentColor" stroke="none" />
    </>
  ),
  scissors: (
    <>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="m8 8 11 9M8 16 19 7" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l.8 13h9.4l.8-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  undo: <path d="M9 7 4 12l5 5M4 12h9a6 6 0 0 1 0 12h-2" />,
  redo: <path d="m15 7 5 5-5 5M20 12h-9a6 6 0 0 0 0 12h2" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: (
    <>
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  text: <path d="M5 5h14M12 5v14M9 19h6" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 5-5 4 4 2.5-2.5L20 17" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" />
    </>
  ),
  audio: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10v4h4l5 4V6L8 10H4Z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 10v4h4l5 4V6L8 10H4Z" />
      <path d="m16 10 5 5M21 10l-5 5" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M9.5 6.4A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-3.1 3.6M6.4 7.6A15.7 15.7 0 0 0 2.5 12s3.5 6 9.5 6a10 10 0 0 0 4-.8" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    </>
  ),
  magnet: (
    <>
      <path d="M5 4v9a7 7 0 0 0 14 0V4h-4v9a3 3 0 0 1-6 0V4H5Z" />
      <path d="M5 8h4M15 8h4" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5M7.5 10.5h6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h10M18 7h2M4 17h3M11 17h9" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  export: (
    <>
      <path d="M12 4v11m0 0-4-4m4 4 4-4" />
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronDown: <path d="m7 9.5 5 5 5-5" />,
  check: <path d="m5 12.5 4.5 4.5L19 6.5" />,
  keyframe: <path d="M12 4.5 19.5 12 12 19.5 4.5 12Z" />,
  eyedropper: (
    <>
      <path d="m14.5 5.5 4 4M5 19l3.5-1 9.8-9.8a2.8 2.8 0 0 0-4-4L4.5 14 3.5 18l4.5 1" />
      <path d="m13 7.5 3.5 3.5" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 8V4l-2 2a8 8 0 1 0 2.2 8" />
      <path d="M20 4h-4" />
    </>
  ),
  fit: <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />,
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m4 12 8 4.5 8-4.5M4 16l8 4.5 8-4.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
      <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17.5v.5" />
    </>
  ),
  folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
}

export const Icon = ({ name, size = 18, className }: IconProps): ReactNode => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {paths[name]}
  </svg>
)
