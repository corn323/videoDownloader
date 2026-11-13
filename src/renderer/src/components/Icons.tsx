import type { JSX, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function svgProps(size: number, props: IconProps): SVGProps<SVGSVGElement> {
  const { size: _ignored, ...rest } = props
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: false,
    ...rest
  }
}

export function IconDownload({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function IconLink({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
    </svg>
  )
}

export function IconArrowRight({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export function IconSettings({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.63.77 1.05 1.43 1.05H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.95Z" />
    </svg>
  )
}

export function IconList({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  )
}

export function IconSun({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
    </svg>
  )
}

export function IconMoon({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />
    </svg>
  )
}

export function IconMonitor({ size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  )
}

export function IconPause({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M9 5v14M15 5v14" />
    </svg>
  )
}

export function IconPlay({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  )
}

export function IconX({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function IconRetry({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 9A7 7 0 0 1 18 7.2L20 12" />
      <path d="M17.9 15A7 7 0 0 1 6 16.8L4 12" />
    </svg>
  )
}

export function IconRefresh({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

export function IconUpload({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  )
}

export function IconFolder({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  )
}

export function IconTrash({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </svg>
  )
}

export function IconCheck({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  )
}

export function IconAlert({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function IconInfo({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function IconChevronDown({ size = 16, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function IconSparkle({ size = 18, ...props }: IconProps): JSX.Element {
  return (
    <svg {...svgProps(size, props)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.3 6.3 2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4" />
    </svg>
  )
}

export function Spinner({ size = 18, className = '' }: { size?: number; className?: string }): JSX.Element {
  return <span className={`spinner ${className}`.trim()} style={{ width: size, height: size }} aria-hidden />
}

export function BrandMark({ size = 34 }: { size?: number }): JSX.Element {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden>
      <IconDownload size={size * 0.55} />
    </span>
  )
}
