import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ActiveRoom, CoreIdentity } from "@/features/runtime/types";

export function useDextRuntime(isTauri: boolean) {
  const [coreIdentity, setCoreIdentity] = useState<CoreIdentity | null>(null);
  const [coreIdentityError, setCoreIdentityError] = useState<string | null>(null);
  const [appliedRoom, setAppliedRoom] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    let disposed = false;
    let checking = false;
    const refresh = async () => {
      if (checking) return;
      checking = true;
      try {
        const identity = await invoke<CoreIdentity>("core_identity");
        if (!disposed) {
          setCoreIdentity(identity);
          setCoreIdentityError(null);
        }
      } catch (error) {
        if (!disposed) {
          setCoreIdentity(null);
          setCoreIdentityError(String(error));
        }
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
  }, [isTauri]);

  useEffect(() => {
    if (!isTauri || !coreIdentity) {
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

  const markCoreDisconnected = (error: string) => {
    setCoreIdentity(null);
    setCoreIdentityError(error);
    setAppliedRoom(null);
  };

  return { coreIdentity, coreIdentityError, appliedRoom, setAppliedRoom, markCoreDisconnected };
}
