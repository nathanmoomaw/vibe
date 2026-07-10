// Monochrome outline of 💊 — a stroked capsule with the left half filled
// solid, the classic two-tone pill silhouette.
export function PillIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <g transform="rotate(-40 12 12)">
        <rect x="4" y="8.5" width="16" height="7" rx="3.5" />
        <path d="M12 8.5 H7.5 A3.5 3.5 0 0 0 7.5 15.5 H12 Z" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}
