// Debug handle exposed by the app with ?debug (see src/ui/hooks/EngineContext.tsx).
interface Window {
  __resusEngine?: {
    runFor(seconds: number): void;
    dispatch(command: { type: string; [key: string]: unknown }, source?: string): void;
    readonly eventLog: readonly { kind: string; event?: string }[];
  };
}
