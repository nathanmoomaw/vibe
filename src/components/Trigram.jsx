import './Trigram.css'

// lines: [top, mid, bottom] each 0.0 (yin/broken) → 1.0 (yang/solid)
// Renders three horizontal bars inside a bordered frame; gap closes as value → 1
export function Trigram({ lines = [1, 1, 1], color = 'currentColor', size = 22 }) {
  const W = size
  const pad = Math.round(W * 0.14)   // inset padding inside the border frame
  const inner = W - pad * 2
  const lineH = Math.max(2, Math.round(inner * 0.18))
  const spacing = Math.round(inner * 0.18)
  const innerH = lineH * 3 + spacing * 2
  const totalH = innerH + pad * 2
  const r = lineH * 0.35
  const borderR = Math.round(W * 0.16)

  return (
    <svg className="trigram" width={W} height={totalH} viewBox={`0 0 ${W} ${totalH}`}>
      {/* Border frame */}
      <rect
        x={0.5} y={0.5} width={W - 1} height={totalH - 1}
        fill="none"
        stroke={color}
        strokeWidth={0.8}
        strokeOpacity={0.28}
        rx={borderR}
      />
      {/* Trigram bars */}
      {[0, 1, 2].map(i => {
        const t = Math.max(0, Math.min(1, lines[i]))
        const y = pad + i * (lineH + spacing)
        const barW = inner * (0.4 + 0.1 * t)
        const rightX = pad + (inner - barW)
        return (
          <g key={i}>
            <rect x={pad}    y={y} width={barW} height={lineH} fill={color} rx={r} />
            <rect x={rightX} y={y} width={barW} height={lineH} fill={color} rx={r} />
          </g>
        )
      })}
    </svg>
  )
}
