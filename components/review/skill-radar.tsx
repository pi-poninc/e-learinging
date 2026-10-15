/**
 * 依存ライブラリなしのレーダーチャート（SVG）。
 * 現在レベル（塗り）と、過去（1ヶ月前など・点線）を重ねて成長を見せる。
 */
interface Props {
  axes: string[]
  current: (number | null)[]
  past?: (number | null)[]
  max?: number
  size?: number
}

export function SkillRadar({ axes, current, past, max = 5, size = 320 }: Props) {
  const n = axes.length
  if (n < 3) return null
  const cx = size / 2
  const cy = size / 2
  const R = size / 2 - 56

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(max, value)) / max) * R
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))]
  }
  const poly = (vals: (number | null)[]) =>
    vals.map((v, i) => point(i, v ?? 0).map((x) => x.toFixed(1)).join(',')).join(' ')

  const rings = Array.from({ length: max }, (_, i) => (R * (i + 1)) / max)

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size }} role="img" aria-label="スキルレーダーチャート">
      {rings.map((r, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, max)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />
      })}
      {past && (
        <polygon points={poly(past)} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      <polygon points={poly(current)} fill="rgba(37,99,235,0.18)" stroke="#2563eb" strokeWidth={2} />
      {axes.map((label, i) => {
        const [x, y] = point(i, max + 0.7)
        return (
          <text key={i} x={x} y={y} fontSize={11} fill="#374151"
            textAnchor={Math.abs(x - cx) < 4 ? 'middle' : x < cx ? 'end' : 'start'}
            dominantBaseline={Math.abs(y - cy) < 4 ? 'middle' : y < cy ? 'alphabetic' : 'hanging'}>
            {label}
          </text>
        )
      })}
    </svg>
  )
}
