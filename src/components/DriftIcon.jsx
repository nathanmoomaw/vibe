// Monochrome wandering sine-squiggle — represents the organic drift feature
// this icon opens a control panel for. Matches PillIcon's conventions
// (24x24 viewBox, currentColor stroke, no fill) so it sits consistently
// among the other footer buttons.
export function DriftIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12 Q 6 4, 9 12 T 16 12 T 22 8" />
    </svg>
  )
}
