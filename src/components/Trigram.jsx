import './Trigram.css'

// lines: [top, mid, bottom] each 0.0 (yin/broken) → 1.0 (yang/solid)
// Renders three horizontal bars; gap in each closes as value → 1
export function Trigram({ lines = [1, 1, 1], color = 'currentColor', size = 22 }) {
  const W = size
  const lineH = Math.max(2, Math.round(W * 0.18))
  const spacing = Math.round(W * 0.18)
  const totalH = lineH * 3 + spacing * 2
  const r = lineH * 0.35

  return (
    <svg className="trigram" width={W} height={totalH} viewBox={`0 0 ${W} ${totalH}`}>
      {[0, 1, 2].map(i => {
        const t = Math.max(0, Math.min(1, lines[i]))
        const y = i * (lineH + spacing)
        const barW = W * (0.4 + 0.1 * t)
        const rightX = W - barW
        return (
          <g key={i}>
            <rect x={0}      y={y} width={barW} height={lineH} fill={color} rx={r} />
            <rect x={rightX} y={y} width={barW} height={lineH} fill={color} rx={r} />
          </g>
        )
      })}
    </svg>
  )
}
