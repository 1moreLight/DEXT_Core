export interface AppInfo {
  name: string;
  target: string;
  arguments: string;
  working_dir: string;
  icon_png: string;
  source: string;
}

export interface CoreIdentity {
  product_name: string;
  runtime_identity: string;
  process_id: number;
  base_directory: string;
  app_data_directory: string;
  grpc_pipe_name: string;
  assembly_version: string;
  is_core_initialized: boolean;
}

export interface V3SessionStatus {
  active: boolean;
  protocol_version: number;
  room_id: string;
  session_id: string;
  revision: number;
  current_desk_id: string;
  target_desk_id: string;
  queued_desk_id: string;
  transition_id: string;
  operable: boolean;
  player_pid: number;
  deadline_utc: string;
  installation_stamp: string;
  lifecycle: {
    stage: "starting" | "desktop" | "idle";
    playback_paused: boolean;
    locked: boolean;
    revision: number;
  } | null;
}

export interface ActiveRoom {
  sourcePath: string;
  runtimePath: string;
}

export interface PermissionReview {
  id: string;
  label: string;
  declared: string[];
  granted: string[];
  current: boolean;
}

export interface CoverRef {
  kind: "image" | "video";
  src: string;
}

export interface RoomInfo {
  name: string;
  path: string;
  version: number | null;
  desks: number;
  icons: number;
  widgets: number;
  covers?: CoverRef[];
  compatibility?: import("@/lib/room-contract").RoomCompatibility | null;
}
