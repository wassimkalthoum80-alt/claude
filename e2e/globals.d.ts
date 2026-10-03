// Debug handle exposed by the app with ?debug (see src/ui/hooks/EngineContext.tsx).
interface Window {
  __resusEngine?: {
    runFor(seconds: number): void;
    dispatch(command: { type: string; [key: string]: unknown }, source?: string): void;
    readonly eventLog: readonly { kind: string; event?: string }[];
    getSnapshot(): {
      time: number;
      devices: { defib: { shocks: number } };
      control: { paused: boolean };
      scenario: { id: string; seed: number; variant: string | null };
      timers: { arrestStartTime: number | null };
      interventions: { cpr: { active: boolean; totalCompressions: number } };
      patient: {
        cardio: { rhythm: string };
        conditions: { pneumothorax: { side: 'left' | 'right' } | null };
        airway: { device: string; position: string };
      };
    };
  };
  __resusDisplay?: { readonly time: number };
}
