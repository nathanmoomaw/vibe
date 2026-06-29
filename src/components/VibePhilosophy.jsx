import './VibePhilosophy.css'

const PRINCIPLES = [
  { n: '01', t: 'strip to minimum',       d: 'Sound is the product. UI disappears. Controls exist to be set and forgotten.' },
  { n: '02', t: 'progressive disclosure', d: 'Headline first, depth behind tap. Never front-load complexity.' },
  { n: '03', t: 'dark by default',        d: 'Ambient sound is evening practice. The interface should not compete with the mood.' },
  { n: '04', t: 'ritual aesthetic',       d: 'Hand-touched, not gamified. Tactile weight, slow pace. Never a slot machine.' },
  { n: '05', t: 'sound follows symbol',   d: 'Card draw, rune cast, trigram shift — the ambient layer responds. Moon card → 210.42 Hz rises.' },
  { n: '06', t: 'page-turn pace',         d: 'Motion at reading speed, not tap speed. Let the transition breathe.' },
]

export function VibePhilosophy({ onClose }) {
  return (
    <div className="vph__overlay" onClick={onClose}>
      <div className="vph__modal" onClick={e => e.stopPropagation()}>
        <button className="vph__close" onClick={onClose}>×</button>

        <div className="vph__header">
          <span className="vph__icon">🃏</span>
          <div className="vph__title">anti-gimmick</div>
          <div className="vph__sub">vibe · ux principles</div>
        </div>

        <ol className="vph__list">
          {PRINCIPLES.map(p => (
            <li key={p.n} className="vph__item">
              <span className="vph__num">{p.n}</span>
              <div className="vph__content">
                <div className="vph__label">{p.t}</div>
                <div className="vph__desc">{p.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
