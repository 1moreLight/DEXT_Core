export {};

declare global {
  type DextJson = null | boolean | number | string | readonly DextJson[] | { readonly [key: string]: DextJson };
  type DextUnsubscribe = () => void;
  type DextCapability = 'desk.read' | 'desk.navigate' | 'time.read' | 'hardware.read' | 'media.read' | 'media.control'
    | 'audio.read' | 'audio.control' | 'storage.read' | 'storage.write' | 'binding.launch' | 'dext.exit';
  type DextDataCapability = 'time.read' | 'hardware.read' | 'media.read' | 'audio.read';
  type DextCapabilityStatus = 'available' | 'denied' | 'unsupported';
  interface DextLifecycle {
    readonly stage: 'starting' | 'desktop' | 'idle';
    readonly playbackPaused: boolean;
    readonly locked: boolean;
    readonly revision: number;
  }
  interface DextDeskSnapshot {
    readonly protocolVersion: 1;
    readonly roomId: string;
    readonly installationStamp: string;
    readonly sessionId: string;
    readonly revision: number;
    readonly currentDeskId: string;
    readonly targetDeskId: string | null;
    readonly queuedDeskId: string | null;
    readonly transitionId: string | null;
    readonly deadlineUtc: string | null;
    readonly active: boolean;
    readonly operable: boolean;
    readonly lifecycle: DextLifecycle;
  }
  interface DextViewport { readonly width: number; readonly height: number; readonly dpr: number; }
  interface DextSession {
    readonly apiVersion: 1;
    readonly instanceId: string;
    readonly sessionId: string;
    readonly consumerId: string;
    readonly kind: 'scene' | 'widget' | 'dock' | 'html' | 'media';
    readonly capabilities: Readonly<Partial<Record<DextCapability, DextCapabilityStatus>>>;
    readonly config: { readonly [key: string]: DextJson };
    readonly viewport: DextViewport;
    readonly geometryVersion: number;
    readonly placements: Readonly<Partial<Record<string, DextRect | null>>>;
    readonly snapshot: DextDeskSnapshot;
  }
  type DextDataState = { readonly status: 'available'; readonly value: DextJson }
    | { readonly status: 'missing' | 'denied' | 'unsupported' | 'error' };
  type DextNavigate = { readonly type: 'desk.next' | 'desk.previous' } | { readonly type: 'desk.go'; readonly deskId: string };
  interface DextRect { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }
  interface DextButtonRegion extends DextRect { readonly buttonId: string; }
  interface DextOccupiedRegion extends DextRect { readonly id: string; readonly deskId?: string; }
  interface DextGroupGeometry { readonly matrix: readonly [number, number, number, number, number, number]; readonly opacity: number; }
  interface DextGeometryReport {
    readonly groups?: Readonly<Partial<Record<'source' | 'target' | 'shared', DextGroupGeometry>>>;
    readonly occupied?: readonly DextOccupiedRegion[];
    readonly buttons?: readonly DextButtonRegion[];
  }
  interface DextActionResult { readonly status: string; }
  interface DextPublicButton { readonly id: string; readonly name: string; readonly scope: string; readonly action: string | null; readonly isBound: boolean; }
  interface DextButtonsResult extends DextActionResult { readonly buttons?: readonly DextPublicButton[]; }
  interface DextDiagnostics {
    readonly disposed: boolean;
    readonly ready: boolean;
    readonly pendingRequests: number;
    readonly subscriptions: number;
    readonly lastError: { readonly code: string; readonly scope?: string } | null;
  }
  interface DextAPI {
    readonly apiVersion: 1;
    readonly session: DextSession | null;
    ready(): Promise<DextSession>;
    dispose(): void;
    diagnostics(): DextDiagnostics;
    readonly desk: {
      get(): Promise<DextDeskSnapshot>;
      subscribe(listener: (snapshot: DextDeskSnapshot) => void): DextUnsubscribe;
      navigate(action: DextNavigate): Promise<DextActionResult>;
    };
    readonly lifecycle: { subscribe(listener: (state: DextLifecycle) => void): DextUnsubscribe; };
    readonly config: {
      get(): { readonly [key: string]: DextJson };
      subscribe(listener: (config: { readonly [key: string]: DextJson }) => void): DextUnsubscribe;
    };
    readonly capabilities: {
      get(): Readonly<Partial<Record<DextCapability, DextCapabilityStatus>>>;
      subscribe(listener: (statuses: Readonly<Partial<Record<DextCapability, DextCapabilityStatus>>>) => void): DextUnsubscribe;
    };
    readonly data: {
      subscribe(capability: DextDataCapability, listener: (state: DextDataState) => void): DextUnsubscribe;
      bindReadout(capability: DextDataCapability, element: HTMLElement,
        render: (value: DextJson, element: HTMLElement) => void): DextUnsubscribe;
    };
    readonly actions: { list(): Promise<DextButtonsResult>; activate(buttonId: string): Promise<DextActionResult>; };
    readonly storage: { get(key: string): Promise<DextJson>; set(key: string, value: DextJson): Promise<DextActionResult>; };
    readonly media: { control(action: 'play' | 'pause' | 'toggle' | 'next' | 'previous'): Promise<DextActionResult>; };
    readonly audio: { control(settings: { volume?: number; muted?: boolean }): Promise<DextActionResult>; };
    readonly scene: {
      subscribeGeometry(listener: (geometry: { readonly geometryVersion: number; readonly viewport: DextViewport; readonly placements: Readonly<Partial<Record<string, DextRect | null>>> }) => void): DextUnsubscribe;
      publishGeometry(report: DextGeometryReport): Promise<DextActionResult>;
      completeTransition(transitionId: string): Promise<DextActionResult>;
      done(): Promise<DextActionResult>;
    };
  }
  var Dext: DextAPI;
  interface Window { readonly Dext: DextAPI; }
}
