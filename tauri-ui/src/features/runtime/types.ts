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
}
