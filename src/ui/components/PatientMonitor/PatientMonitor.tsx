import type { ReactNode } from 'react';
import type { SignalChannel } from '../../../sim';
import type { TooltipId } from '../../../content/tooltips/parameters';
import { bisNumerics } from '../../adapters/bisViewModel';
import { monitorViewModel } from '../../adapters/viewModels';
import { useEngine } from '../../hooks/EngineContext';
import { useUi } from '../../hooks/UiContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import type { SweepGrid, SweepScale } from '../../render/SweepRenderer';
import { TraceCanvas } from '../TraceCanvas/TraceCanvas';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './PatientMonitor.module.css';

interface RowProps {
  label: string;
  /** extra control in the waveform area (e.g. the ECG cable switch) */
  extra?: ReactNode;
  /** small alarm-limit stacks shown beside the numeric */
  limits?: ReactNode;
  /** click on the numeric → open its alarm limits */
  onOpenLimits?: () => void;
  channel: SignalChannel;
  color: string;
  scale: SweepScale;
  sweepSpeed: number;
  grid?: SweepGrid;
  tooltip: TooltipId;
  children: ReactNode;
}

function MonitorRow({
  label,
  channel,
  color,
  scale,
  sweepSpeed,
  grid,
  tooltip,
  extra,
  limits,
  onOpenLimits,
  children,
}: RowProps) {
  return (
    <div className={styles.row} style={{ ['--ch' as string]: color }}>
      <div className={styles.wave}>
        <span className={styles.waveLabel}>{label}</span>
        {extra}
        <div className={styles.canvasBox}>
          <TraceCanvas
            channel={channel}
            color={color}
            scale={scale}
            sweepSpeed={sweepSpeed}
            {...(grid ? { grid } : {})}
            label={label}
          />
        </div>
      </div>
      <Tooltip
        id={tooltip}
        className={styles.numeric}
        {...(onOpenLimits ? { onActivate: onOpenLimits } : {})}
      >
        {children}
        {limits}
      </Tooltip>
    </div>
  );
}

/** Alarm limits as real monitors show them: small, upper over lower, beside the value. */
function LimitStack({ high, low, className }: { high: string; low: string; className?: string }) {
  return (
    <span className={`num ${styles.limits} ${className ?? ''}`} aria-hidden>
      <span>{high}</span>
      <span>{low}</span>
    </span>
  );
}

const flashClass = (p: 'high' | 'medium' | 'low' | null) =>
  p === 'high' ? 'flash-high' : p === 'medium' ? 'flash-medium' : '';

/** BIS numerics: index, SQI and EMG bars, BSV (with its window while filling) and the sensor status. */
function BisNumericBlock({ vm }: { vm: ReturnType<typeof bisNumerics> }) {
  const t = useT();
  return (
    <div className={styles.bis} data-testid="bis-numerics">
      <span className={styles.bisLabel}>{t('bis.label')}</span>
      {vm.statusKey && vm.status !== 'startup' ? (
        <span className={styles.bisStatus} data-testid="bis-status">
          {t(vm.statusKey)}
        </span>
      ) : (
        <span className={`num ${styles.bisValue}`} data-testid="bis-value">
          {vm.bis}
        </span>
      )}
      <span className={styles.bisBars}>
        <span className={styles.bisBar}>
          <span className={styles.bisBarLabel}>{t('bis.sqi')}</span>
          <span className={styles.bisTrack}>
            <span className={styles.bisFillSqi} style={{ width: `${vm.sqiBar * 100}%` }} />
          </span>
        </span>
        <span className={styles.bisBar}>
          <span className={styles.bisBarLabel}>{t('bis.emg')}</span>
          <span className={styles.bisTrack}>
            <span className={styles.bisFillEmg} style={{ width: `${vm.emgBar * 100}%` }} />
          </span>
        </span>
      </span>
      <span className={`num ${styles.bsv}`} title={t('bis.bsvTooltip')} data-testid="bsv">
        {t('bis.bsv')} {vm.bsv}
        <span className={styles.unitInline}>%</span>
        {vm.bsvWindow && <span className={styles.bsvWindow}> {vm.bsvWindow}</span>}
      </span>
    </div>
  );
}

/**
 * Multiparameter patient monitor: ECG II (+ V5 with a 5-electrode cable), pleth, arterial line, capnogram —
 * waveform left, numerics right. ST is measured in lead II (and V5) like a real monitor.
 */
export function PatientMonitor() {
  const t = useT();
  const engine = useEngine();
  const vm = useEngineSelector(monitorViewModel, deepEqual);
  const bis = useEngineSelector(bisNumerics, deepEqual);
  const { setUi } = useUi();
  const five = vm.ecgLeads === 5;
  const compact = five || bis.connected;
  const open = (param: string) => () => setUi({ limitsOpen: true, limitsFocus: param });
  const L = vm.limits;

  const leadSwitch = (
    <div className={styles.leadSwitch} role="radiogroup" title={t('monitor.leadsHint')}>
      {([3, 5] as const).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={vm.ecgLeads === n}
          className={vm.ecgLeads === n ? styles.leadActive : ''}
          onClick={() => engine.dispatch({ type: 'SET_ECG_LEADS', leads: n }, 'user')}
          data-testid={`ecg-leads-${n}`}
        >
          {t(n === 3 ? 'monitor.leads3' : 'monitor.leads5')}
        </button>
      ))}
    </div>
  );

  const stLine = (lead: string, value: string) => (
    <span className={`num ${styles.st} ${flashClass(vm.flash.st)}`}>
      {t('monitor.st')}-{lead} {value}
      <span className={styles.unitInline}>mm</span>
    </span>
  );

  return (
    <section
      className={`hud-panel ${styles.monitor} ${five ? styles.compact : compact ? styles.compactBis : ''}`}
      aria-label="Patient monitor"
    >
      <MonitorRow
        label={t('monitor.ecg')}
        channel="ecg"
        color="var(--ecg)"
        scale={{ min: -0.7, max: 1.45, padding: 4 }}
        sweepSpeed={25}
        tooltip="hr"
        extra={leadSwitch}
        limits={<LimitStack high={L.hr.high} low={L.hr.low} />}
        onOpenLimits={open('hr')}
      >
        <span className={styles.paramLabel}>
          <span className={styles.heart}>♥</span> {t('monitor.hr')}
        </span>
        <span className={`num ${styles.bigValue} ${flashClass(vm.flash.hr)}`}>{vm.hr}</span>
        <span className={styles.unit}>/min</span>
        {!five && stLine('II', vm.stII)}
      </MonitorRow>

      {five && (
        <MonitorRow
          label={t('monitor.ecgV')}
          channel="ecgV"
          color="var(--ecg)"
          scale={{ min: -0.6, max: 1.8, padding: 4 }}
          sweepSpeed={25}
          tooltip="st"
          limits={<LimitStack high={L.st} low="" />}
          onOpenLimits={open('st')}
        >
          <span className={styles.paramLabel}>{t('monitor.st')}</span>
          {stLine('II', vm.stII)}
          {stLine('V5', vm.stV)}
        </MonitorRow>
      )}

      <MonitorRow
        label={t('monitor.pleth')}
        channel="pleth"
        color="var(--spo2)"
        scale={{ min: -0.75, max: 0.75, padding: 4 }}
        sweepSpeed={25}
        tooltip="spo2"
        limits={<LimitStack high={L.spo2.high} low={L.spo2.low} />}
        onOpenLimits={open('spo2')}
      >
        <span className={styles.paramLabel}>{t('monitor.spo2')}</span>
        <span className={`num ${styles.bigValue} ${flashClass(vm.flash.spo2)}`}>{vm.spo2}</span>
        <span className={styles.unit}>%</span>
      </MonitorRow>

      <MonitorRow
        label={t('monitor.art')}
        channel="art"
        color="var(--art)"
        scale={{ min: 0, max: 160, padding: 3 }}
        sweepSpeed={25}
        grid={{ lines: [0, 80, 160], color: 'rgba(255, 64, 64, 0.14)' }}
        tooltip="art"
        limits={
          <>
            <LimitStack high={L.artSys.high} low={L.artSys.low} />
            <LimitStack high={L.artMean.high} low={L.artMean.low} className={styles.limitsMean} />
          </>
        }
        onOpenLimits={open('artSys')}
      >
        <span className={`num ${styles.artValue} ${flashClass(vm.flash.art)}`}>{vm.artSysDia}</span>
        <span className={`num ${styles.artMean} ${flashClass(vm.flash.art)}`}>
          ({vm.artMean})<span className={styles.unitInline}>mmHg</span>
        </span>
        {vm.ppv !== '' && (
          <span className={`num ${styles.ppv}`}>
            {t('monitor.ppv')} {vm.ppv}
            <span className={styles.unitInline}>%</span>
          </span>
        )}
      </MonitorRow>

      <MonitorRow
        label={t('monitor.etco2')}
        channel="co2"
        color="var(--co2)"
        scale={{ min: 0, max: 50, padding: 4 }}
        sweepSpeed={6.25}
        tooltip="etco2"
        limits={<LimitStack high={L.etco2.high} low={L.etco2.low} />}
        onOpenLimits={open('etco2')}
      >
        <span className={styles.paramLabel} aria-hidden>
          &nbsp;
        </span>
        <span className={`num ${styles.bigValue} ${flashClass(vm.flash.etco2)}`}>{vm.etco2}</span>
        <span className={styles.unit}>mmHg</span>
      </MonitorRow>

      {bis.connected && (
        <MonitorRow
          label={t('bis.eeg')}
          channel="eeg"
          color="var(--eeg)"
          scale={{ min: -100, max: 100, padding: 2 }}
          sweepSpeed={25}
          grid={{ lines: [-50, 0, 50], color: 'rgba(199, 164, 255, 0.12)' }}
          tooltip="bis"
          extra={<span className={styles.eegScale}>{t('bis.scale')}</span>}
          onOpenLimits={() => setUi({ bisOpen: true })}
        >
          <BisNumericBlock vm={bis} />
        </MonitorRow>
      )}
    </section>
  );
}
