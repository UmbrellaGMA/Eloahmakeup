"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";

type Day = { day: string; revenue: number; orders: number };

/**
 * Faturamento diário (série única → sem legenda; o título nomeia a série).
 * Barras finas com topo arredondado de 4px ancoradas na base, 2px de espaço
 * entre barras, grade recessiva, tooltip por barra e tabela para leitores de tela.
 */
export function RevenueChart({ data }: { data: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => Number(d.revenue)));
  const niceMax = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / p) * p;
  })();
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, slot - 2);
  const ticks = [0, 0.5, 1].map((t) => niceMax * t);
  const label = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Faturamento diário dos últimos 30 dias">
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / niceMax) * innerH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#ece8f0" strokeWidth={1} />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#5e5866">
                {t >= 1000 ? `R$ ${(t / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `R$ ${t.toFixed(0)}`}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const v = Number(d.revenue);
          const bh = (v / niceMax) * innerH;
          const x = pad.left + i * slot + 1;
          const y = pad.top + innerH - bh;
          const r = Math.min(4, bh, barW / 2);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* área de toque maior que a barra */}
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" />
              {bh > 0 && (
                <path
                  d={`M${x},${y + bh} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + bh} Z`}
                  fill="#8656bf"
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              {(i % 5 === 0 || i === data.length - 1) && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#5e5866">
                  {label(d.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lift"
          style={{ left: `${((pad.left + hover * slot + slot / 2) / W) * 100}%` }}
        >
          <p className="font-semibold">{label(h.day)}</p>
          <p>{formatPrice(h.revenue)} aprovado</p>
          <p className="text-white/70">{h.orders} {h.orders === 1 ? "pedido" : "pedidos"}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>Faturamento diário</caption>
        <thead><tr><th>Dia</th><th>Faturamento</th><th>Pedidos</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.day}><td>{label(d.day)}</td><td>{formatPrice(d.revenue)}</td><td>{d.orders}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
