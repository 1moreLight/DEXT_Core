import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActiveRoom, CoreIdentity, V3SessionStatus } from "@/features/runtime/types";

export function useDextRuntime(isTauri: boolean) {
  const [coreIdentity, setCoreIdentity] = useState<CoreIdentity | null>(null);
  const [coreIdentityError, setCoreIdentityError] = useState<string | null>(null);
  const [appliedRoom, setAppliedRoom] = useState<string | null>(null);
  const [v3Session, setV3Session] = useState<V3SessionStatus | null>(null);
  const identityRequest = useRef(0);

  const refreshCore = useCallback(async () => {
    if (!isTauri) return;
    const request = ++identityRequest.current;
    try {
      const identity = await invoke<CoreIdentity>("core_identity");
      if (request === identityRequest.current) {
        setCoreIdentity(identity);
        setCoreIdentityError(null);
      }
    } catch (error) {
      if (request === identityRequest.current) {
        setCoreIdentity(null);
        setCoreIdentityError(String(error));
      }
    }
  }, [isTauri]);

  useEffect(() => {
    if (!isTauri) return;
    void refreshCore();
    const timer = window.setInterval(() => void refreshCore(), 2000);
    return () => {
      identityRequest.current++;
      window.clearInterval(timer);
    };
  }, [isTauri, refreshCore]);

  useEffect(() => {
    if (!isTauri || !coreIdentity?.is_core_initialized) {
      setAppliedRoom(null);
      return;
    }
    let disposed = false;
    let checking = false;
    const refresh = async () => {
      if (checking) return;
      checking = true;
      try {
        const active = await invoke<ActiveRoom | null>("active_room");
        if (!disposed) setAppliedRoom(active?.sourcePath ?? null);
      } catch {
        if (!disposed) setAppliedRoom(null);
      } finally {
        checking = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [coreIdentity, isTauri]);

  useEffect(() => {
    if (!isTauri || !coreIdentity?.is_core_initialized) {
      setV3Session(null);
      return;
    }
    let disposed = false;
    let checking = false;
    const refresh = async () => {
      if (checking) return;
      checking = true;
      try {
        const status = await invoke<V3SessionStatus>("v3_session_status");
        if (!disposed) setV3Session(status.active ? status : null);
      } catch {
        if (!disposed) setV3Session(null);
      } finally {
        checking = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [coreIdentity?.process_id, coreIdentity?.is_core_initialized, isTauri]);

  const markCoreDisconnected = (error: string) => {
    identityRequest.current++;
    setCoreIdentity(null);
    setCoreIdentityError(error);
    setAppliedRoom(null);
    setV3Session(null);
  };

  return { coreIdentity, coreIdentityError, v3Session, appliedRoom, setAppliedRoom, markCoreDisconnected, refreshCore };
}
