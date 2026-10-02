import { useState } from 'react';
import type { InfectionLogEntry, InfectionView, LabPanel, MicroReport } from '../../../sim';
import {
  countLabel,
  LAB_ROWS,
  labColumns,
  microInbox,
  resistogramRows,
  wardTime,
  type SpecimenCard,
} from '../../adapters/ward';
import { useTk } from './useWard';
import styles from './Ward.module.css';

const LAB_UNITS: Record<keyof LabPanel, string> = {
  wbc: 'G/L',
  crp: 'mg/L',
  pct: 'ng/mL',
  creatinine: 'mg/dL',
  lactate: 'mmol/L',
  platelets: 'G/L',
  bilirubin: 'mg/dL',
  vancomycinTrough: 'mg/L',
};

/** Laboratory values per day (last draw of each day). */
export function LabsTable({
  view,
  startHourOfDay,
}: {
  view: InfectionView;
  startHourOfDay: number;
}) {
  const tk = useTk();
  const cols = labColumns(view, startHourOfDay);
  const rows = LAB_ROWS.filter((k) => cols.some((c) => c.labs[k] !== undefined));
  return (
    <section className={styles.card} aria-label={tk('ward.labs')}>
      <header className={styles.cardHeader}>
        <h2>{tk('ward.labs')}</h2>
      </header>
      <div className={styles.tableScroll}>
        <table className={styles.labs} data-testid="ward-labs">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c.day}>
                  {tk('ward.day', { n: c.day })}
                  <span className={styles.dim}> {wardTime(c.t, startHourOfDay).clock}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k}>
                <th scope="row">
                  {tk(`lab.${k}`)} <span className={styles.dim}>{LAB_UNITS[k]}</span>
                </th>
                {cols.map((c) => (
                  <td key={c.day}>{c.labs[k] ?? '–'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportLine({ report, atH, start }: { report: MicroReport; atH: number; start: number }) {
  const tk = useTk();
  const time = wardTime(atH, start);
  const stamp = `${tk('ward.day', { n: time.day })} ${time.clock}`;
  const [open, setOpen] = useState(true);
  switch (report.stage) {
    case 'positive-signal':
      return (
        <li className={styles.reportCall}>
          <span className={styles.stamp}>{stamp}</span>
          {tk('micro.positive', {
            sets: report.positiveSets,
            taken: report.setsTaken,
            ttp: report.ttpH.toFixed(1),
            morph: `micro.morph.${report.morphology}`,
          })}
        </li>
      );
    case 'identification':
      return (
        <li>
          <span className={styles.stamp}>{stamp}</span>
          {report.rapid ? (
            <>
              {tk('micro.rapid')}:{' '}
              {report.rapid
                .map(
                  (r) => `${r.test} ${r.positive ? tk('micro.detected') : tk('micro.notDetected')}`,
                )
                .join(' · ')}
            </>
          ) : report.growth.length === 0 ? (
            tk('micro.noGrowth')
          ) : (
            report.growth
              .map(
                (g) =>
                  `${tk(`org.${g.organismId}`)}${g.count !== undefined ? ` ${countLabel(g.count)}/mL` : ''}${
                    g.positiveSets !== undefined
                      ? ` (${tk('micro.sets', { n: g.positiveSets })})`
                      : ''
                  }`,
              )
              .join(' · ')
          )}
        </li>
      );
    case 'susceptibility':
      return (
        <li>
          <button
            type="button"
            className={styles.linkish}
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            <span className={styles.stamp}>{stamp}</span>
            {tk('micro.ast', { org: `org.${report.organismId}` })}
            {report.mrgn !== 'none' && <span className={styles.mrgn}>{report.mrgn}</span>}
            {report.mechanisms.map((m) => (
              <span key={m} className={styles.mech}>
                {tk(`mech.${m}`)}
              </span>
            ))}
          </button>
          {open && (
            <div className={styles.ast} data-testid="resistogram">
              {resistogramRows(report.ast).map(({ drugId, s }) => (
                <span key={drugId} className={`${styles.astCell} ${styles[`sir${s}`]}`}>
                  <span>{tk(`abx.${drugId}`)}</span>
                  <b>{s}</b>
                </span>
              ))}
            </div>
          )}
        </li>
      );
    case 'no-growth':
      return (
        <li>
          <span className={styles.stamp}>{stamp}</span>
          {tk(report.final ? 'micro.noGrowthFinal' : 'micro.noGrowthPrelim')}
        </li>
      );
    case 'mixed-flora':
      return (
        <li>
          <span className={styles.stamp}>{stamp}</span>
          {tk('micro.mixedFlora')}
        </li>
      );
    case 'test-result':
      return (
        <li className={report.positive ? styles.reportCall : undefined}>
          <span className={styles.stamp}>{stamp}</span>
          {report.detailKey
            ? tk(report.detailKey)
            : tk(report.positive ? 'micro.testPositive' : 'micro.testNegative')}
        </li>
      );
  }
}

function SpecimenItem({ card, start }: { card: SpecimenCard; start: number }) {
  const tk = useTk();
  const taken = wardTime(card.takenAtH, start);
  const o = card.order;
  return (
    <li className={styles.specimen} data-testid={`specimen-${card.specimenId}`}>
      <div className={styles.specimenHead}>
        <b>{tk(`specimen.${o.kind}`)}</b>
        {o.kind === 'blood-culture' && (
          <span className={styles.dim}>
            {' '}
            {tk(o.site === 'catheter-blood' ? 'site.catheter' : 'site.peripheral')} ·{' '}
            {tk('micro.setsTaken', { n: o.sets ?? 1 })}
          </span>
        )}
        <span className={styles.dim}>
          {' '}
          · {tk('micro.taken')} {tk('ward.day', { n: taken.day })} {taken.clock}
        </span>
        {card.onAntibiotics && <span className={styles.warnTag}>{tk('micro.onAntibiotics')}</span>}
        <span className={styles[`status_${card.status}`]}>{tk(`micro.status.${card.status}`)}</span>
      </div>
      <ul className={styles.reports}>
        {card.reports.map((r, i) => (
          <ReportLine key={i} report={r.report} atH={r.atH} start={start} />
        ))}
      </ul>
    </li>
  );
}

/** Microbiology results as they arrive, newest specimen first. */
export function MicroInbox({
  log,
  startHourOfDay,
}: {
  log: readonly InfectionLogEntry[];
  startHourOfDay: number;
}) {
  const tk = useTk();
  const cards = microInbox(log);
  return (
    <section className={styles.card} aria-label={tk('ward.micro')}>
      <header className={styles.cardHeader}>
        <h2>{tk('ward.micro')}</h2>
      </header>
      {cards.length === 0 ? (
        <p className={styles.dim}>{tk('ward.micro.empty')}</p>
      ) : (
        <ul className={styles.specimens} data-testid="micro-inbox">
          {cards.map((c) => (
            <SpecimenItem key={c.specimenId} card={c} start={startHourOfDay} />
          ))}
        </ul>
      )}
    </section>
  );
}
