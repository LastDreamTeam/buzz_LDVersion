import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { checkForkRelease } from "./fork-releases.mjs";

// Preserve the upstream UI contract, but expose only manual download states.
// There is no install handle, unsigned auto-install, or upstream fallback.
export type UpdateStatus =
  | {
      state:
        | "idle"
        | "checking"
        | "up-to-date"
        | "unavailable"
        | "downloading"
        | "installing"
        | "ready";
    }
  | { state: "available"; version: string }
  | { state: "error"; message: string }
  | { state: "manual-required"; version: string; releaseUrl: string };

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({ state: "idle" });
  const busy = useRef(false);
  const mounted = useRef(false);
  const manualRequested = useRef(false);
  const performCheck = useCallback(async (background: boolean) => {
    if (busy.current) {
      if (!background) manualRequested.current = true;
      return;
    }
    busy.current = true;
    manualRequested.current = !background;
    if (!background) setStatus({ state: "checking" });
    try {
      const next = await checkForkRelease(await getVersion());
      if (
        mounted.current &&
        (next.state === "manual-required" || manualRequested.current)
      )
        setStatus(next);
    } catch (error) {
      if (mounted.current && manualRequested.current)
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : String(error),
        });
    } finally {
      busy.current = false;
      manualRequested.current = false;
    }
  }, []);
  const checkForUpdate = useCallback(() => performCheck(false), [performCheck]);
  const installAndRelaunch = useCallback(async () => {
    // Defensive guard even if an upstream UI accidentally invokes this callback.
    setStatus({
      state: "error",
      message:
        "LD builds require a verified manual installer; automatic installation is disabled.",
    });
  }, []);
  useEffect(() => {
    mounted.current = true;
    void performCheck(true);
    const timer = window.setInterval(
      () => void performCheck(true),
      6 * 60 * 60 * 1000,
    );
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [performCheck]);
  return { status, checkForUpdate, installAndRelaunch };
}
