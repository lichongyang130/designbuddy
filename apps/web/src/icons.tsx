import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  }
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 10v9h12v-9" />
  </svg>
)

export const ChatIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-5.5A7 7 0 0 1 11 5h2a7 7 0 0 1 7 7Z" />
  </svg>
)

export const FolderIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H10l2 2.5h5.5A2.5 2.5 0 0 1 20 11v6.5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5Z" />
  </svg>
)

export const MemoryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4a4 4 0 0 1 4 4v.5a3.5 3.5 0 0 1 2 6.4V17a3 3 0 0 1-3 3h-3" />
    <path d="M12 4a4 4 0 0 0-4 4v.5a3.5 3.5 0 0 0-2 6.4V17a3 3 0 0 0 3 3h3" />
    <path d="M12 4v16" />
  </svg>
)

export const PluginIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10 4h4v3a2 2 0 1 0 4 0h2v4h-3a2 2 0 1 0 0 4h3v5h-5v-2.5a2 2 0 1 0-4 0V20H6v-5h2.5a2 2 0 1 0 0-4H6V6h4Z" />
  </svg>
)

export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z" />
  </svg>
)

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9 21h6a1.8 1.8 0 0 0 1.7-1.8L17.5 7" />
  </svg>
)

export const SparkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5l1.7 4.6 4.8 1.7-4.8 1.7L12 16.1l-1.7-4.6L5.5 9.8l4.8-1.7Z" />
  </svg>
)

export const HelpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <path d="M9.8 9.3a2.3 2.3 0 1 1 3.4 2.1c-.7.4-1.2.9-1.2 1.8" />
    <path d="M12 16.4h.01" />
  </svg>
)

export const MicIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8" />
    <path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0M12 17.7V20.5" />
  </svg>
)

export const ArrowUpIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />
  </svg>
)

export const AttachIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14.5 7.5 8.9 13a2.6 2.6 0 0 0 3.7 3.7l6.3-6.3a4.4 4.4 0 0 0-6.2-6.2l-6.6 6.6a6.2 6.2 0 0 0 8.8 8.8l3.2-3.2" />
  </svg>
)

export const ExpandIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 15 4.5 19.5M4.5 15v4.5H9M15 9l4.5-4.5M19.5 9V4.5H15" />
  </svg>
)

export const PresentationIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="5" width="17" height="11" rx="2" />
    <path d="M12 16v3.5M8.5 21h7" />
  </svg>
)

export const DocIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 4.5h7L18.5 10v9.5H6Z" />
    <path d="M12.5 4.5V10H18" />
  </svg>
)

export const CarouselIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="7" y="6.5" width="10" height="11" rx="1.8" />
    <path d="M3.5 9v6M20.5 9v6" />
  </svg>
)

export const ImageIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4.5 17.5 4.7-4.3 3.3 3 2.6-2.2 4.4 3.8" />
  </svg>
)

export const BrushIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15.5 4.5 19.5 8.5 9.8 18.2l-4.3 1 1-4.3Z" />
    <path d="m13.5 6.5 4 4" />
  </svg>
)

export const ImportIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4.5v10M8 11l4 3.5 4-3.5" />
    <path d="M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2" />
  </svg>
)

export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6.5 9.5 5.5 5 5.5-5" />
  </svg>
)

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </svg>
)

export const FileIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 4.5h7L18 9.5V19.5h-11.5Z" />
    <path d="M13 4.5V9.5h5" />
  </svg>
)

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
)
