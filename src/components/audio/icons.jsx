import React from 'react'

// Icons drawn to mirror the Figma vectors. Stroke width / fills match the design.

export function PlayIcon({ size = 16, className = '', color = '#fff' }) {
  return (
    <svg width={size} height={size * (16.45 / 15.29)} viewBox="0 0 15.29 16.45" className={className} fill={color}>
      <path d="M0 1.21C0 0.387 0.897 -0.118 1.6 0.311l12.3 7.514c0.681 0.416 0.681 1.403 0 1.819L1.6 16.158c-0.703 0.43 -1.6 -0.075 -1.6 -0.898V1.21z" />
    </svg>
  )
}

export function PauseIcon({ size = 16, className = '', color = '#fff' }) {
  return (
    <svg width={size} height={size * (15 / 10.5)} viewBox="0 0 10.5 15" className={className} fill={color}>
      <rect x="0" y="0" width="3.5" height="15" rx="0.75" />
      <rect x="7" y="0" width="3.5" height="15" rx="0.75" />
    </svg>
  )
}

// Multi-bar audio visualizer — 6 vertical strokes of varying height.
export function AudioWaveIcon({ size = 24, className = '', color = '#ffffffcc', strokeWidth = 1.4 }) {
  const cx = size / 2
  // x positions and heights extracted from Figma node 42:506.
  const bars = [
    { x: 2, h: 3 },
    { x: 6, h: 11 },
    { x: 10, h: 18 },
    { x: 14, h: 7 },
    { x: 18, h: 13 },
    { x: 22, h: 3 },
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {bars.map((b, i) => {
        const y1 = 12 - b.h / 2
        const y2 = 12 + b.h / 2
        return (
          <line
            key={i}
            x1={b.x}
            y1={y1}
            x2={b.x}
            y2={y2}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}

export function PlusIcon({ size = 24, className = '', color = '#fff', strokeWidth = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

// Trash icon — Figma node 42:535. Original SVG path exported from the design,
// scaled into a 24×24 viewBox so callers can size it like any other icon here.
export function TrashIcon({ size = 24, className = '', color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 21" className={className} fill="none">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5 2.978V3.205C14.799 3.324 16.093 3.495 17.378 3.717C17.475 3.734 17.568 3.770 17.651 3.822C17.734 3.875 17.806 3.943 17.863 4.024C17.920 4.104 17.960 4.195 17.982 4.291C18.003 4.387 18.006 4.487 17.989 4.584C17.972 4.681 17.936 4.774 17.884 4.857C17.831 4.940 17.763 5.012 17.682 5.069C17.601 5.126 17.511 5.166 17.415 5.188C17.318 5.209 17.219 5.212 17.122 5.195L16.913 5.160L15.908 18.230C15.850 18.984 15.510 19.687 14.955 20.201C14.401 20.715 13.673 21 12.917 21H5.084C4.328 21 3.600 20.715 3.046 20.201C2.491 19.687 2.151 18.984 2.093 18.230L1.087 5.160L0.878 5.195C0.781 5.212 0.682 5.209 0.585 5.188C0.489 5.166 0.398 5.126 0.318 5.069C0.155 4.954 0.045 4.780 0.011 4.584C-0.023 4.388 0.022 4.187 0.137 4.024C0.252 3.861 0.426 3.751 0.622 3.717C1.907 3.494 3.201 3.323 4.500 3.205V2.978C4.500 1.414 5.713 0.078 7.316 0.027C8.439 -0.009 9.562 -0.009 10.685 0.027C12.288 0.078 13.500 1.414 13.500 2.978ZM7.364 1.526C8.455 1.491 9.546 1.491 10.637 1.526C11.390 1.550 12 2.184 12 2.978V3.091C10.002 2.970 7.998 2.970 6.000 3.091V2.978C6.000 2.184 6.609 1.550 7.364 1.526ZM7.009 7.471C7.005 7.372 6.982 7.276 6.941 7.186C6.900 7.097 6.841 7.016 6.769 6.949C6.696 6.882 6.612 6.830 6.519 6.796C6.427 6.762 6.328 6.746 6.230 6.750C6.132 6.754 6.035 6.777 5.945 6.818C5.856 6.859 5.775 6.918 5.708 6.990C5.641 7.062 5.589 7.147 5.555 7.240C5.521 7.332 5.505 7.430 5.509 7.529L5.856 16.529C5.864 16.728 5.950 16.915 6.096 17.050C6.168 17.117 6.253 17.169 6.346 17.204C6.438 17.238 6.536 17.253 6.635 17.249C6.733 17.246 6.830 17.222 6.919 17.181C7.009 17.140 7.089 17.082 7.156 17.009C7.223 16.937 7.275 16.852 7.309 16.760C7.343 16.668 7.359 16.569 7.355 16.471L7.009 7.471ZM12.489 7.529C12.496 7.429 12.483 7.328 12.451 7.232C12.418 7.137 12.367 7.049 12.300 6.974C12.233 6.899 12.151 6.839 12.060 6.796C11.969 6.753 11.871 6.729 11.770 6.725C11.669 6.721 11.569 6.737 11.475 6.773C11.381 6.809 11.295 6.863 11.222 6.933C11.150 7.002 11.092 7.086 11.052 7.178C11.012 7.271 10.991 7.370 10.991 7.471L10.644 16.471C10.636 16.670 10.708 16.864 10.843 17.010C10.978 17.156 11.166 17.242 11.365 17.250C11.564 17.258 11.758 17.186 11.904 17.051C12.050 16.916 12.136 16.728 12.144 16.529L12.489 7.529Z"
        fill={color}
      />
    </svg>
  )
}

// Heart icon — Figma node 64:71. Used as the "favorite" / saved indicator.
// Default fill is the Figma red #CC3636 but the color prop can override it
// (e.g. white when used as the "favorites" filter tab icon).
export function HeartIcon({ size = 20, className = '', color = '#cc3636' }) {
  return (
    <svg width={size} height={size * (18 / 20)} viewBox="0 0 20 18" className={className} fill={color}>
      <path d="M9.395 17.910L9.388 17.907L9.366 17.895C9.237 17.824 9.110 17.752 8.983 17.677C7.461 16.773 6.038 15.710 4.739 14.507C2.438 12.360 0 9.174 0 5.250C0 2.322 2.464 0 5.438 0C6.265 -0.004 7.082 0.178 7.828 0.534C8.575 0.889 9.232 1.408 9.750 2.052C10.268 1.408 10.925 0.889 11.672 0.533C12.419 0.178 13.236 -0.004 14.063 0C17.036 0 19.500 2.322 19.500 5.250C19.500 9.175 17.062 12.361 14.761 14.506C13.462 15.709 12.039 16.772 10.517 17.676C10.390 17.751 10.263 17.824 10.134 17.895L10.112 17.907L10.105 17.911L10.102 17.912C9.994 17.970 9.873 18 9.750 18C9.627 18 9.506 17.970 9.398 17.912L9.395 17.910Z" />
    </svg>
  )
}

// Folder/library icon — Figma node 57:79. Used as the "All audios" filter tab.
export function FolderIcon({ size = 20, className = '', color = '#ffffffcc' }) {
  return (
    <svg width={size} height={size * (15 / 17.5)} viewBox="0 0 17.5 15" className={className} fill={color}>
      <path d="M15 15C15.663 15 16.299 14.737 16.768 14.268C17.237 13.799 17.5 13.163 17.5 12.5V8.75C17.5 8.087 17.237 7.451 16.768 6.982C16.299 6.513 15.663 6.25 15 6.25H2.5C1.837 6.25 1.201 6.513 0.732 6.982C0.263 7.451 0 8.087 0 8.75V12.5C0 13.163 0.263 13.799 0.732 14.268C1.201 14.737 1.837 15 2.5 15H15ZM0 5.955V2.5C0 1.837 0.263 1.201 0.732 0.732C1.201 0.263 1.837 0 2.5 0H6.983C7.479 0 7.956 0.198 8.308 0.549L10.076 2.317C10.193 2.434 10.352 2.5 10.518 2.5H15C15.663 2.5 16.299 2.763 16.768 3.232C17.237 3.701 17.5 4.337 17.5 5V5.955C16.813 5.339 15.923 4.999 15 5H2.5C1.577 4.999 0.687 5.339 0 5.955Z" />
    </svg>
  )
}

// Link icon — Figma node 57:25 (chain link). Used inside the "Extract from link" input.
export function LinkIcon({ size = 16, className = '', color = '#ffffffcc' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" className={className} fill={color}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.5625 2.34374C6.0085 2.34374 5.4599 2.45286 4.9481 2.66487C4.4362 2.87689 3.9711 3.18764 3.5794 3.57938C3.1876 3.97113 2.8769 4.43620 2.6649 4.94805C2.4529 5.45989 2.3437 6.00848 2.3437 6.56249C2.3437 7.11651 2.4529 7.66509 2.6649 8.17694C2.8769 8.68878 3.1876 9.15385 3.5794 9.5456C3.9711 9.93735 4.4362 10.2481 4.9481 10.4601C5.4599 10.6721 6.0085 10.7812 6.5625 10.7812C7.6814 10.7812 8.7544 10.3368 9.5456 9.5456C10.3368 8.75443 10.7812 7.68137 10.7812 6.56249C10.7812 5.44361 10.3368 4.37055 9.5456 3.57938C8.7544 2.78822 7.6814 2.34374 6.5625 2.34374ZM1.4062 6.56249C1.4063 5.73443 1.6059 4.91857 1.988 4.18393C2.3701 3.44929 2.9235 2.81748 3.6014 2.34194C4.2793 1.86641 5.0618 1.56113 5.8826 1.45194C6.7034 1.34276 7.5385 1.43287 8.3171 1.71465C9.0958 1.99644 9.7951 2.46161 10.356 3.07082C10.9168 3.68003 11.3227 4.41535 11.5393 5.21459C11.7558 6.01383 11.7767 6.85348 11.6002 7.66251C11.4236 8.47153 11.0549 9.22614 10.525 9.86249L13.4563 12.7937C13.5023 12.8367 13.5392 12.8884 13.5649 12.9459C13.5905 13.0034 13.6043 13.0655 13.6054 13.1284C13.6065 13.1914 13.5949 13.2539 13.5713 13.3122C13.5478 13.3706 13.5127 13.4236 13.4681 13.4681C13.4236 13.5127 13.3706 13.5477 13.3122 13.5713C13.2539 13.5949 13.1914 13.6065 13.1284 13.6054C13.0655 13.6043 13.0034 13.5905 12.9459 13.5649C12.8884 13.5392 12.8367 13.5023 12.7937 13.4562L9.8625 10.525C9.1095 11.1522 8.1934 11.5518 7.2214 11.677C6.2495 11.8023 5.2620 11.6479 4.3746 11.2321C3.4872 10.8163 2.7367 10.1562 2.2110 9.3292C1.6853 8.5021 1.4061 7.5425 1.4062 6.56249Z"
      />
    </svg>
  )
}

// Send / submit circle icon — Figma node 57:64 (right side of the extract-from-link input).
export function SendCircleIcon({ size = 24, className = '', color = '#ffffffcc' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={color}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.25C6.615 2.25 2.25 6.615 2.25 12C2.25 17.385 6.615 21.75 12 21.75C17.385 21.75 21.75 17.385 21.75 12C21.75 6.615 17.385 2.25 12 2.25ZM12.75 9C12.75 8.801 12.671 8.610 12.530 8.470C12.390 8.329 12.199 8.25 12 8.25C11.801 8.25 11.610 8.329 11.470 8.470C11.329 8.610 11.25 8.801 11.25 9V11.25H9C8.801 11.25 8.610 11.329 8.470 11.470C8.329 11.610 8.25 11.801 8.25 12C8.25 12.199 8.329 12.390 8.470 12.530C8.610 12.671 8.801 12.75 9 12.75H11.25V15C11.25 15.199 11.329 15.390 11.470 15.530C11.610 15.671 11.801 15.75 12 15.75C12.199 15.75 12.390 15.671 12.530 15.530C12.671 15.390 12.75 15.199 12.75 15V12.75H15C15.199 12.75 15.390 12.671 15.530 12.530C15.671 12.390 15.75 12.199 15.75 12C15.75 11.801 15.671 11.610 15.530 11.470C15.390 11.329 15.199 11.25 15 11.25H12.75V9Z"
      />
    </svg>
  )
}

// Speaker / volume icon — used in the speed/volume tab switcher label.
export function VolumeIcon({ size = 20, className = '', color = '#ffffffb2' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} fill={color}>
      <path d="M9.5 3.5a1 1 0 0 0-1.6-0.8L4.4 5.3H2.5A1.5 1.5 0 0 0 1 6.8v6.4A1.5 1.5 0 0 0 2.5 14.7h1.9l3.5 2.6a1 1 0 0 0 1.6-0.8V3.5z" />
      <path d="M13.5 6.5a1 1 0 0 1 1 0 5 5 0 0 1 0 7 1 1 0 1 1-1-1.732 3 3 0 0 0 0-3.536 1 1 0 0 1 0-1.732z" />
    </svg>
  )
}

// Bookmark icon — kept for backward compat.
export function BookmarkIcon({ size = 20, className = '', color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={color}>
      <path d="M6 3a2 2 0 0 0-2 2v16.382a1 1 0 0 0 1.447.894L12 19l6.553 3.276A1 1 0 0 0 20 21.382V5a2 2 0 0 0-2-2H6z" />
    </svg>
  )
}

export function UploadIcon({ size = 24, className = '', color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill={color}>
      <path d="M12 3a1 1 0 0 1 .707.293l5 5a1 1 0 1 1-1.414 1.414L13 6.414V16a1 1 0 1 1-2 0V6.414L7.707 9.707A1 1 0 1 1 6.293 8.293l5-5A1 1 0 0 1 12 3zM4 18a1 1 0 0 1 1 1v1h14v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" />
    </svg>
  )
}

// Equalizer / control sliders icon — node 42:560.
export function ControlIcon({ size = 20, className = '', color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} fill={color}>
      <path d="M3 4a1 1 0 0 1 1-1h2v3H4a1 1 0 0 1-1-1V4zm5-1h8a1 1 0 1 1 0 2H8V3zM3 9a1 1 0 0 1 1-1h8v3H4a1 1 0 0 1-1-1V9zm11-1h2a1 1 0 1 1 0 2h-2V8zM3 14a1 1 0 0 1 1-1h2v3H4a1 1 0 0 1-1-1v-1zm5-1h8a1 1 0 1 1 0 2H8v-2z" />
      <rect x="5" y="2" width="2" height="5" rx="0.5" />
      <rect x="11" y="7" width="2" height="5" rx="0.5" />
      <rect x="5" y="12" width="2" height="5" rx="0.5" />
    </svg>
  )
}

// Gear / settings icon — node 42:567.
export function SettingsIcon({ size = 20, className = '', color = '#ffffffcc' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} fill={color}>
      <path d="M11.49 2.18a1 1 0 0 1 .96.72l0.31 1.04a6.5 6.5 0 0 1 1.32 0.77l1.06-0.18a1 1 0 0 1 1.04 0.51l0.51 0.88a1 1 0 0 1-0.08 1.16l-0.69 0.83a6.5 6.5 0 0 1 0 1.52l0.69 0.83a1 1 0 0 1 0.08 1.16l-0.51 0.88a1 1 0 0 1-1.04 0.51l-1.06-0.18a6.5 6.5 0 0 1-1.32 0.77l-0.31 1.04a1 1 0 0 1-0.96 0.72h-1.02a1 1 0 0 1-0.96-0.72L8.2 13.4a6.5 6.5 0 0 1-1.32-0.77l-1.06 0.18a1 1 0 0 1-1.04-0.51l-0.51-0.88a1 1 0 0 1 0.08-1.16l0.69-0.83a6.5 6.5 0 0 1 0-1.52l-0.69-0.83a1 1 0 0 1-0.08-1.16l0.51-0.88a1 1 0 0 1 1.04-0.51l1.06 0.18a6.5 6.5 0 0 1 1.32-0.77l0.31-1.04a1 1 0 0 1 0.96-0.72h1.02zM10 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
    </svg>
  )
}
