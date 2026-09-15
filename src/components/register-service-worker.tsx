"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // instalabilidade é um "nice to have" no MVP — falha silenciosa
      });
    }
  }, []);

  return null;
}
