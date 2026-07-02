import './Trigram.css'

// lines: [top, mid, bottom] each 0.0 (yin/broken) → 1.0 (yang/solid), morphs continuously
// outline: [top, mid, bottom] each exactly 0 or 1 — the nearest discrete (unmorphed) trigram,
//   traced as a crisp stroke so the shape reads clearly even mid-morph
export function Trigram({ lines = [1, 1, 1], outline = null, color = 'currentColor', size = 22 }) {
  const W = size
  const pad = Math.round(W * 0.14)
  const inner = W - pad * 2
  const lineH = Math.max(2, Math.round(inner * 0.18))
  const spacing = Math.round(inner * 0.18)
  const innerH = lineH * 3 + spacing * 2
  const totalH = innerH + pad * 2
  const r = lineH * 0.35
  const gapW = inner * 0.4
  const lightColor = `color-mix(in oklch, ${color} 65%, white)`

  return (
    <svg className="trigram" width={W} height={totalH} viewBox={`0 0 ${W} ${totalH}`}>
      {[0, 1, 2].map(i => {
        const t = Math.max(0, Math.min(1, lines[i]))
        const y = pad + i * (lineH + spacing)
        const barW = inner * (0.4 + 0.1 * t)
        const rightX = pad + (inner - barW)
        const solid = outline ? outline[i] === 1 : null
        return (
          <g key={i}>
            <rect x={pad}    y={y} width={barW} height={lineH} fill={color} rx={r} />
            <rect x={rightX} y={y} width={barW} height={lineH} fill={color} rx={r} />
            {outline && (solid ? (
              <rect x={pad} y={y} width={inner} height={lineH}
                fill="none" stroke={lightColor} strokeWidth={0.9} rx={r} />
            ) : (
              <>
                <rect x={pad}              y={y} width={gapW} height={lineH}
                  fill="none" stroke={lightColor} strokeWidth={0.9} rx={r} />
                <rect x={pad + inner - gapW} y={y} width={gapW} height={lineH}
                  fill="none" stroke={lightColor} strokeWidth={0.9} rx={r} />
              </>
            ))}
          </g>
        )
      })}
    </svg>
  )
}
