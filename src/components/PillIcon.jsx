// Monochrome outline of 💊 — a stroked capsule with the left half filled
// solid, the classic two-tone pill silhouette.
//
// `rainbow` swaps the two-tone fill for true black/white and traces the
// capsule's outline with a slowly rotating rainbow gradient — used for the
// large presets-modal title, kept off by default so footer-button usages
// keep the plain currentColor treatment (matching the other footer icons).
export function PillIcon({ size = 14, rainbow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {rainbow && (
        <defs>
          <linearGradient id="pill-rainbow" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#ff3b3b" />
            <stop offset="16%"  stopColor="#ff9d3b" />
            <stop offset="33%"  stopColor="#f4e33b" />
            <stop offset="50%"  stopColor="#3bff6e" />
            <stop offset="66%"  stopColor="#3bcbff" />
            <stop offset="83%"  stopColor="#8a3bff" />
            <stop offset="100%" stopColor="#ff3b3b" />
            <animateTransform attributeName="gradientTransform" type="rotate" from="0 12 12" to="360 12 12" dur="5s" repeatCount="indefinite" />
          </linearGradient>
        </defs>
      )}
      <g transform="rotate(-40 12 12)">
        <rect
          x="4" y="8.5" width="16" height="7" rx="3.5"
          fill={rainbow ? '#0a0a0a' : 'none'}
          stroke={rainbow ? 'url(#pill-rainbow)' : 'currentColor'}
        />
        <path
          d="M12 8.5 H7.5 A3.5 3.5 0 0 0 7.5 15.5 H12 Z"
          fill={rainbow ? '#f2f2f2' : 'currentColor'}
          stroke="none"
        />
      </g>
    </svg>
  )
}
