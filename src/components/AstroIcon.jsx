// Monochrome star-chart wheel — a ringed circle with a few scattered points,
// evoking the astro chart this icon opens. Matches PillIcon/DriftIcon's
// conventions (24x24 viewBox, currentColor stroke, no fill).
export function AstroIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="7" />
      <path d="M12 6v2M12 18v2M5 13h2M17 13h2" strokeWidth="1.3" />
      <circle cx="19" cy="4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="4" cy="6" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="20" cy="19" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
