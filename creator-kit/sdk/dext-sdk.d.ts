export type DextPermission =
  | "time.read" | "locale.read" | "viewport.read" | "desk.read" | "playback.read"
  | "audio.spectrum" | "hardware.cpu.read" | "hardware.gpu.read" | "hardware.memory.read"
  | "now-playing.read" | "now-playing.artwork.read" | "system.volume.read"
  | "hardware.network.read" | "action.invoke";

export interface DextSession {
  readonly kind: "scene" | "widget";
  readonly instanceId: string;
  readonly token: string;
  readonly permissions: readonly DextPermission[];
  readonly viewport: Readonly<{ width?: number; height?: number }>;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface DextSdk {
  readonly protocol: 1;
  readonly session: DextSession | null;
  get<T = unknown>(capability: DextPermission): T | undefined;
  subscribe<T = unknown>(capability: DextPermission, listener: (value: T) => void): () => void;
  ready(): boolean;
  done(detail?: unknown): boolean;
  error(message: unknown): boolean;
}

declare global {
  const dext: DextSdk;
  interface WindowEventMap { dextready: CustomEvent<DextSession>; }
}

export {};
