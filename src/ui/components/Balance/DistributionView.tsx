import type { SimulationState } from '../../../sim';
import { distributionView } from '../../adapters/balanceViewModel';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './BalancePanel.module.css';

/** Round the hidden values so the view re-renders only when something visible changes. */
function vm(s: Readonly<SimulationState>) {
  const d = distributionView(s);
  const r = (x: number) => Math.round(x);
  return {
    pools: d.pools.map((p) => ({ ...p, ml: r(p.ml), delta: p.delta === null ? null : r(p.delta) })),
    seq: {
      ascites: r(d.seq.ascites),
      pleural: r(d.seq.pleural),
      gut: r(d.seq.gut),
      haematoma: r(d.seq.haematoma),
    },
    fluxes: Object.fromEntries(Object.entries(d.fluxes).map(([k, v]) => [k, r(v)])) as Record<
      keyof typeof d.fluxes,
      number
    >,
    tracer: d.tracer && {
      ...d.tracer,
      delivered: r(d.tracer.delivered),
      parts: d.tracer.parts.map((p) => ({ ...p, ml: r(p.ml) })),
    },
    lab: {
      hb: d.lab.hb.toFixed(1),
      hct: Math.round(100 * d.lab.hct),
      na: d.lab.na.toFixed(0),
      cl: d.lab.cl.toFixed(0),
      albumin: d.lab.albumin.toFixed(0),
      osm: d.lab.osm.toFixed(0),
      hco3: d.lab.hco3Shift.toFixed(1),
      lungWater: Math.round(100 * d.lab.lungWater),
      coag: Math.round(d.lab.coag),
      platelets: Math.round(d.lab.platelets),
    },
  };
}

const TRACER_COLOURS: Record<string, string> = {
  plasma: '#e0525c',
  isf: '#5fb3e0',
  lung: '#8fd0ff',
  icf: '#8a7fe0',
  seq: '#d6a14a',
  urine: '#e8d24a',
  other: '#7a8590',
};

/**
 * "Simulierte Verteilung": hidden model compartments (not measurable at the bedside), with the current transfer
 * rates and the conservative attribution of the most recent bolus ("Modellzuordnung").
 */
export function DistributionView() {
  const t = useT();
  const d = useEngineSelector(vm, deepEqual);
  const f = d.fluxes;
  return (
    <div className={styles.model} data-testid="bal-distribution">
      <p className={styles.note}>{t('bal.modelNote')}</p>
      <svg viewBox="0 0 480 190" className={styles.diagram} role="img" aria-label={t('bal.model')}>
        <defs>
          <marker
            id="arr"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 z" fill="#9aa7b4" />
          </marker>
        </defs>
        {[
          { x: 10, y: 70, w: 110, key: 'plasma', c: '#e0525c' },
          { x: 185, y: 70, w: 120, key: 'isf', c: '#5fb3e0' },
          { x: 365, y: 70, w: 105, key: 'icf', c: '#8a7fe0' },
          { x: 10, y: 5, w: 110, key: 'lung', c: '#8fd0ff' },
          { x: 185, y: 140, w: 120, key: 'seq', c: '#d6a14a' },
          { x: 10, y: 140, w: 110, key: 'bladder', c: '#e8d24a' },
        ].map((b) => {
          const p = d.pools.find((x) => x.key === b.key);
          return (
            <g key={b.key}>
              <rect x={b.x} y={b.y} width={b.w} height={44} rx={4} fill="none" stroke={b.c} />
              <text x={b.x + 6} y={b.y + 15} fill={b.c} fontSize="11">
                {p ? t(p.label) : ''}
              </text>
              <text x={b.x + 6} y={b.y + 33} fill="#dfe6ee" fontSize="12">
                {p ? `${p.ml} mL` : ''}
                {p && p.delta !== null ? ` (${p.delta >= 0 ? '+' : ''}${p.delta})` : ''}
              </text>
            </g>
          );
        })}
        <line x1="122" y1="84" x2="183" y2="84" stroke="#9aa7b4" markerEnd="url(#arr)" />
        <text
          x="126"
          y="79"
          fill="#9aa7b4"
          fontSize="9"
        >{`${t('bal.f.filtration')} ${f.filtration}`}</text>
        <line x1="183" y1="102" x2="122" y2="102" stroke="#9aa7b4" markerEnd="url(#arr)" />
        <text x="126" y="113" fill="#9aa7b4" fontSize="9">{`${t('bal.f.lymph')} ${f.lymph}`}</text>
        <line x1="307" y1="92" x2="363" y2="92" stroke="#9aa7b4" markerEnd="url(#arr)" />
        <text x="309" y="87" fill="#9aa7b4" fontSize="9">{`${t('bal.f.cells')} ${f.cells}`}</text>
        <line x1="65" y1="68" x2="65" y2="51" stroke="#9aa7b4" markerEnd="url(#arr)" />
        <text x="72" y="63" fill="#9aa7b4" fontSize="9">{`${t('bal.f.lung')} ${f.lung}`}</text>
        <line x1="245" y1="116" x2="245" y2="138" stroke="#9aa7b4" markerEnd="url(#arr)" />
        <text
          x="252"
          y="131"
          fill="#9aa7b4"
          fontSize="9"
        >{`${t('bal.f.seq')} ${f.sequestration}`}</text>
        <line x1="65" y1="116" x2="65" y2="138" stroke="#9aa7b4" markerEnd="url(#arr)" />
        <text x="72" y="131" fill="#9aa7b4" fontSize="9">{`${t('bal.f.urine')} ${f.urine}`}</text>
        <text x="330" y="160" fill="#9aa7b4" fontSize="9">
          {t('bal.f.unit')}
        </text>
      </svg>
      <p className={styles.note}>
        {t('bal.seqDetail', {
          ascites: d.seq.ascites,
          pleural: d.seq.pleural,
          gut: d.seq.gut,
          haematoma: d.seq.haematoma,
        })}
      </p>

      {d.tracer ? (
        <div className={styles.tracer} data-testid="bal-tracer">
          <div className={styles.k}>
            {t('bal.tracer')}: {d.tracer.label} · {d.tracer.delivered} mL
          </div>
          <div className={styles.tracerBar}>
            {d.tracer.parts
              .filter((p) => p.ml > 0)
              .map((p) => (
                <span
                  key={p.key}
                  style={{
                    flex: p.ml,
                    background: TRACER_COLOURS[p.key] ?? '#777',
                  }}
                  title={`${t(p.label)} ${p.ml} mL`}
                />
              ))}
          </div>
          <div className={styles.tracerLegend}>
            {d.tracer.parts.map((p) => (
              <span key={p.key}>
                <i style={{ background: TRACER_COLOURS[p.key] ?? '#777' }} /> {t(p.label)} {p.ml}
              </span>
            ))}
          </div>
          <p className={styles.note}>{t('bal.tracerNote')}</p>
        </div>
      ) : (
        <p className={styles.note}>{t('bal.tracerNone')}</p>
      )}

      <div className={styles.lab}>
        <span>Hb {d.lab.hb} g/dL</span>
        <span>Hkt {d.lab.hct} %</span>
        <span>Na {d.lab.na}</span>
        <span>Cl {d.lab.cl} mmol/L</span>
        <span>Alb {d.lab.albumin} g/L</span>
        <span>Osm {d.lab.osm}</span>
        <span>ΔHCO₃ {d.lab.hco3}</span>
        <span>
          {t('bal.d.lung')} {d.lab.lungWater} %
        </span>
        <span>
          {t('bal.coag')} {d.lab.coag} %
        </span>
        <span>
          {t('bal.platelets')} {d.lab.platelets} %
        </span>
      </div>
      <p className={styles.note}>{t('bal.labNote')}</p>
    </div>
  );
}
