import { useState } from 'react';

// Grafico de linea de una sola serie (evolucion de un ejercicio).
// Tocar/pasar el dedo muestra el valor del punto mas cercano.
const W = 340;
const H = 180;
const PAD = { top: 16, right: 12, bottom: 26, left: 40 };

const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

function niceTicks(min, max, count = 4) {
  if (min === max) {
    min -= 5;
    max += 5;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 10) / 10);
  return ticks;
}

export default function ProgressChart({ points, valueKey, unit = 'kg', label }) {
  const [active, setActive] = useState(points.length - 1);
  const values = points.map((p) => p[valueKey]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks.at(-1);
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points.at(-1).date).getTime();
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (p) => PAD.left + (t1 === t0 ? iw / 2 : ((new Date(p.date).getTime() - t0) / (t1 - t0)) * iw);
  const y = (v) => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(p[valueKey]).toFixed(1)}`).join(' ');

  const pick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p) - px) < Math.abs(x(points[best]) - px)) best = i;
    });
    setActive(best);
  };

  const a = points[Math.min(active, points.length - 1)];

  return (
    <figure className="chart">
      <div className="chart-readout" aria-live="polite">
        <strong>{a[valueKey]} {unit}</strong>
        <span className="muted small">
          {label} · {fmtDate(a.date)}
          {valueKey === 'weight' && a.reps ? ` · ${a.reps} reps` : ''}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}: de ${values[0]} a ${values.at(-1)} ${unit} en ${points.length} sesiones`}
        onPointerMove={pick}
        onPointerDown={pick}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="chart-axis" x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end">{t}</text>
          </g>
        ))}
        <text className="chart-axis" x={PAD.left} y={H - 6}>{fmtDate(points[0].date)}</text>
        {points.length > 1 && (
          <text className="chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">{fmtDate(points.at(-1).date)}</text>
        )}
        <line className="chart-crosshair" x1={x(a)} x2={x(a)} y1={PAD.top} y2={PAD.top + ih} />
        <path className="chart-line" d={path} />
        {points.map((p, i) => (
          <circle
            key={i}
            className={`chart-dot ${i === active ? 'active' : ''}`}
            cx={x(p)}
            cy={y(p[valueKey])}
            r={i === active ? 5 : 4}
          />
        ))}
      </svg>
    </figure>
  );
}
