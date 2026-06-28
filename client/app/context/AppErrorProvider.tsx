"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import {
  registerUnauthorizedHandler,
  type AppError,
} from "@/lib/errors";

export function AppErrorProvider({ children }: { children: React.ReactNode }) {
  const { logoutSilent } = useAuth();
  const handledUnauthorizedCode = useRef<string | null>(null);

  useEffect(() => {
    registerUnauthorizedHandler((error: AppError) => {
      const key = error.code ?? error.type;
      if (handledUnauthorizedCode.current === key) return;
      handledUnauthorizedCode.current = key;
      logoutSilent();
      window.setTimeout(() => {
        handledUnauthorizedCode.current = null;
      }, 3500);
    });

    return () => registerUnauthorizedHandler(null);
  }, [logoutSilent]);

  return children;
}
