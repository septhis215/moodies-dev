"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import LoadingMascot from "./LoadingMascot";
import { createLoadingScreenState } from "./loading-screen-state";

const LoadingScreenContext = createContext<{
  visible: boolean;
  register: () => () => void;
} | null>(null);

export function LoadingScreenProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [loadingState] = useState(() => createLoadingScreenState(setVisible));
  const value = useMemo(
    () => ({ visible, register: loadingState.register }),
    [visible, loadingState],
  );

  useEffect(() => () => loadingState.dispose(), [loadingState]);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  return (
    <LoadingScreenContext.Provider value={value}>
      <div inert={visible} aria-hidden={visible || undefined}>
        {children}
      </div>
      {visible && (
        <div role="status" aria-live="polite" aria-label="Loading Moodies">
          <span className="sr-only">Getting your page ready…</span>
          <LoadingMascot />
        </div>
      )}
    </LoadingScreenContext.Provider>
  );
}

/** Register only full-page fallbacks; section skeletons stay within the page. */
export function PageLoadingSignal() {
  const context = useContext(LoadingScreenContext);
  const register = context?.register;
  useEffect(() => register?.(), [register]);
  // The server-rendered fallback covers the screen before effects can run.
  return context?.visible ? null : <LoadingMascot />;
}
