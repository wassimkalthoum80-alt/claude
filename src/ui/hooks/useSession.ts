import { useCallback, useMemo } from 'react';
import { MODULE_CATALOG } from '../../content/modules/catalog';
import { SCENARIOS } from '../../content/scenarios';
import { INFECTION_CASE_BY_ID } from '../../content/infection/cases';
import { recordExplored } from '../../game/progression';
import { createSession } from '../../game/session';
import type { ModuleId } from '../../game/types';
import { bridgeScenario, type BridgeKind } from '../../content/scenarios/bridge';
import { ALIGN_WINDOW_S } from '../../sim';
import {
  arrivalSupport,
  continuationCommands,
  episodeStart,
  handoverTargets,
  realtimeOutcome,
} from '../../game/bridge';
import { finishScoredSession, MIN_DEBRIEF_S } from '../adapters/debrief';
import { localProgressStore } from '../progressStore';
import { useEngine } from './EngineContext';
import { useUi, WORKSPACE_CLOSED } from './UiContext';
import { useWardStore } from './WardStoreContext';
import { CAMPAIGN_CONFIG } from '../../content/campaign/hospital';
import { INFECTION_CASES } from '../../content/infection/cases';
import { caseModifiers, caseSeed, newCampaign, nextCaseId } from '../../game/campaign';
import { localCampaignStore } from '../campaignStore';

/** A new 32-bit seed (wall-clock randomness is fine here: the seed itself is stored and logged). */
function freshSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] ?? Date.now() >>> 0;
}

export interface SessionActions {
  /** open a module's submenu from HOME */
  openModule: (module: ModuleId) => void;
  /** back to HOME (from a submenu or a running session) */
  goHome: () => void;
  /** start a catalog entry: configure the engine, open the workspace with the session intro */
  start: (module: ModuleId, entryId: string) => void;
  /** restart the running session from its seed */
  restart: () => void;
  /**
   * end the running session: a scored session that ran long enough is scored and opens the debrief; otherwise
   * back to the module menu
   */
  end: () => void;
  /** open the My Progress screen */
  openProgress: () => void;
  /** ward case → real-time episode in the workstation (emergency admission or shock) */
  startBridge: (kind: BridgeKind) => void;
  /** open the hospital-campaign dashboard */
  openCampaign: () => void;
  /** hospital campaign: the next patient of this hospital (starts a campaign if none is stored) */
  startCampaignCase: () => void;
}

/**
 * Session flow (milestone 6 § 3). Starting a session loads its scenario into the one engine with the
 * session's seed; the engine stays the sole owner of the simulation and records every command in its log.
 */
export function useSession(): SessionActions {
  const engine = useEngine();
  const wardStore = useWardStore();
  const { ui, setUi } = useUi();
  const module = ui.session?.module ?? null;

  const pause = useCallback(() => {
    if (!engine.getSnapshot().control.paused)
      engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
  }, [engine]);

  const openModule = useCallback(
    (m: ModuleId) =>
      m === 'progress'
        ? setUi({ screen: 'progress', menuModule: null })
        : setUi({ screen: 'module', menuModule: m }),
    [setUi],
  );

  const openProgress = useCallback(
    () => setUi({ ...WORKSPACE_CLOSED, screen: 'progress', session: null }),
    [setUi],
  );

  const goHome = useCallback(() => {
    pause();
    setUi({ ...WORKSPACE_CLOSED, screen: 'home', menuModule: null, session: null });
  }, [pause, setUi]);

  const start = useCallback(
    (m: ModuleId, entryId: string) => {
      const mod = MODULE_CATALOG.find((x) => x.id === m);
      const entry = mod?.sections.flatMap((s) => s.entries).find((e) => e.id === entryId);
      if (mod?.engine === 'course') {
        // Infectiology: the ward screen creates its own course engine from the case and the session seed;
        // the real-time engine stays paused.
        const infectionCase = INFECTION_CASE_BY_ID.get(entry?.scenarioId ?? '');
        if (!entry || !infectionCase) return;
        pause();
        const session = createSession(MODULE_CATALOG, m, entryId, {
          difficulty: ui.difficulty,
          // Cases with seeded variants get a fresh seed (a different hidden truth each time); kept in the session.
          seed: infectionCase.variants ? freshSeed() : infectionCase.seed,
          now: Date.now(),
        });
        setUi({
          ...WORKSPACE_CLOSED,
          screen: 'ward',
          session,
          briefingOpen: true,
          bridge: null,
          bridgeReturn: null,
        });
        return;
      }
      const listed = SCENARIOS.find((s) => s.id === entry?.scenarioId);
      if (!entry || (!listed && !entry.pool)) return;
      const session = createSession(MODULE_CATALOG, m, entryId, {
        difficulty: ui.difficulty,
        // Cases with patient variants and unknown cases get a fresh seed per session (a different patient or
        // case each time); the seed is kept in the session, so the run stays reproducible.
        seed: entry.pool || listed?.variants ? freshSeed() : (listed?.seed ?? freshSeed()),
        now: Date.now(),
      });
      const scenario = SCENARIOS.find((s) => s.id === session.scenarioId);
      if (!scenario) return;
      engine.loadScenario(scenario, session.seed);
      // Physiology Lab: unscored; opening an experiment counts towards exploring.
      if (m === 'lab') {
        const before = localProgressStore.load();
        const r = recordExplored(before, m, entryId, Date.now());
        if (r.profile !== before) localProgressStore.save(r.profile);
      }
      engine.dispatch({ type: 'SET_DIFFICULTY', difficulty: session.difficulty }, 'system');
      // The patient waits behind the session intro until the learner presses Start.
      engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
      setUi({ ...WORKSPACE_CLOSED, screen: 'session', session, briefingOpen: true });
    },
    [engine, pause, setUi, ui.difficulty],
  );

  const restart = useCallback(() => {
    const session = ui.session;
    if (session && engine.scenario.variants) {
      // A restart of a case with variants brings the next patient (new seed), same help level.
      const seed = freshSeed();
      engine.loadScenario(engine.scenario, seed);
      engine.dispatch({ type: 'SET_DIFFICULTY', difficulty: session.difficulty }, 'system');
      setUi({ ...WORKSPACE_CLOSED, session: { ...session, seed } });
      return;
    }
    engine.dispatch({ type: 'RESET' }, 'user');
    setUi({ ...WORKSPACE_CLOSED });
  }, [engine, setUi, ui.session]);

  const startBridge = useCallback(
    (kind: BridgeKind) => {
      const wardSession = ui.session;
      const course = wardStore.current();
      if (!wardSession || !course || ui.screen !== 'ward') return;
      const preset = course.realtimePreset();
      // The same patient: a further episode continues the workstation state as it was handed over; only a first
      // episode (or one after something else was loaded) builds the patient from the course's preset.
      const continuing = wardStore.canContinue(engine.loadCount);
      const scenario = bridgeScenario(
        preset,
        kind,
        course.caseDef.patient,
        course.caseDef.realtimeKind,
        continuing,
        arrivalSupport(course.getView().support),
      );
      // A new patient arrives with the ward's measured values (MAP, heart rate, saturation, lactate).
      if (!continuing) engine.loadHandover(scenario, wardSession.seed, handoverTargets(preset));
      // Course-owned causes (vasoplegia, leak, temperature) and the protocol's noradrenaline dose.
      for (const c of continuationCommands(preset, engine.getSnapshot()))
        engine.dispatch(c, 'system');
      if (continuing) {
        // The ward hours since the handover pass for the held patient (drugs, bags, urine; body water held by the
        // ward's care); then the case layer of the new episode starts from now.
        const since = wardStore.heldSinceH();
        const gapS = since !== null ? Math.max(0, course.timeH - since) * 3600 : 0;
        engine.backgroundAdvance(Math.max(0, gapS - ALIGN_WINDOW_S), { holdVolumes: true });
        // The last minutes of the ward period run in full physiology: the held patient arrives with the ward's
        // measured values (second transfer), keeping the drugs, airway and fluids given so far.
        engine.alignToWard(handoverTargets(preset));
        engine.continueScenario(scenario);
      }
      engine.dispatch({ type: 'SET_DIFFICULTY', difficulty: wardSession.difficulty }, 'system');
      engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
      wardStore.startRecording(episodeStart(engine.getSnapshot()));
      // The course clock is held from now; the episode's minutes are counted once at the handover.
      course.dispatch({ type: 'REALTIME_EPISODE_START', kind }, 'system');
      setUi({
        ...WORKSPACE_CLOSED,
        screen: 'session',
        // The workstation runs unscored: the episode's result goes back to the ward case.
        session: {
          ...wardSession,
          scenarioId: scenario.id,
          titleKey: scenario.titleKey,
          scored: false,
          instructorPanel: false,
        },
        bridge: { wardSession, kind },
        bridgeReturn: null,
        briefingOpen: true,
      });
    },
    [engine, setUi, ui.screen, ui.session, wardStore],
  );

  const openCampaign = useCallback(() => {
    pause();
    setUi({ ...WORKSPACE_CLOSED, screen: 'campaign', menuModule: 'infectio', session: null });
  }, [pause, setUi]);

  const startCampaignCase = useCallback(() => {
    let state = localCampaignStore.load();
    if (!state) {
      state = newCampaign(CAMPAIGN_CONFIG, freshSeed());
      localCampaignStore.save(state);
    }
    const caseId = nextCaseId(
      CAMPAIGN_CONFIG,
      state,
      INFECTION_CASES.map((c) => c.id),
    );
    const mod = MODULE_CATALOG.find((x) => x.id === 'infectio');
    const entry = mod?.sections.flatMap((x) => x.entries).find((e) => e.scenarioId === caseId);
    if (!caseId || !entry) return;
    pause();
    const session = {
      ...createSession(MODULE_CATALOG, 'infectio', entry.id, {
        difficulty: ui.difficulty,
        seed: caseSeed(state),
        now: Date.now(),
      }),
      campaign: {
        index: state.index + 1,
        modifiers: caseModifiers(CAMPAIGN_CONFIG, state.hospital, caseId),
      },
    };
    setUi({
      ...WORKSPACE_CLOSED,
      screen: 'ward',
      session,
      briefingOpen: true,
      bridge: null,
      bridgeReturn: null,
    });
  }, [pause, setUi, ui.difficulty]);

  const end = useCallback(() => {
    pause();
    const session = ui.session;
    if (ui.bridge) {
      // Real time → course: hand the episode back to the ward (nothing to hand over if it never started).
      const rec = wardStore.recorder();
      const snap = engine.getSnapshot();
      const start = rec?.start ?? episodeStart(snap);
      const started = snap.time > start.timeS;
      const outcome = started
        ? realtimeOutcome(rec?.samples ?? [], snap, engine.eventLog, start)
        : null;
      // The workstation keeps this patient as handed over for a further episode.
      const courseEngine = wardStore.current();
      if (!outcome) courseEngine?.dispatch({ type: 'REALTIME_EPISODE_CANCEL' }, 'system');
      // Course time of the handover: the episode start plus its minutes (counted when the ward confirms it).
      const atH = (courseEngine?.timeH ?? 0) + (outcome ? outcome.durationMin / 60 : 0);
      wardStore.markEpisodeEnd(engine.loadCount, atH);
      setUi({
        ...WORKSPACE_CLOSED,
        screen: 'ward',
        session: ui.bridge.wardSession,
        bridge: null,
        bridgeReturn: outcome ? { kind: ui.bridge.kind, outcome } : null,
      });
      return;
    }
    if (ui.screen === 'ward' && session?.campaign) {
      setUi({ ...WORKSPACE_CLOSED, screen: 'campaign', menuModule: 'infectio', session: null });
      return;
    }
    if (ui.screen === 'ward') {
      // Phase 3 adds the stewardship debrief; until then the ward case returns to its menu.
      setUi({ ...WORKSPACE_CLOSED, screen: 'module', menuModule: module, session: null });
      return;
    }
    if (session?.scored && engine.getSnapshot().time >= MIN_DEBRIEF_S) {
      const debrief = finishScoredSession(engine, session, localProgressStore, Date.now());
      setUi({ ...WORKSPACE_CLOSED, screen: 'debrief', menuModule: module, session: null, debrief });
      return;
    }
    setUi({ ...WORKSPACE_CLOSED, screen: 'module', menuModule: module, session: null });
  }, [pause, setUi, module, engine, ui.session, ui.screen, ui.bridge, wardStore]);

  return useMemo(
    () => ({
      openModule,
      goHome,
      start,
      restart,
      end,
      openProgress,
      startBridge,
      openCampaign,
      startCampaignCase,
    }),
    [
      openModule,
      goHome,
      start,
      restart,
      end,
      openProgress,
      startBridge,
      openCampaign,
      startCampaignCase,
    ],
  );
}
