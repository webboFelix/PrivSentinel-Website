"use client";

import { useEffect, useState } from "react";

export function SlowLoadingNotice() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsSlow(true), 5_000);
    return () => window.clearTimeout(timer);
  }, []);

  return isSlow
    ? <span className="slow-loading-notice" aria-live="polite">This is taking longer than usual. We’ll show a retry option if it times out.</span>
    : null;
}
