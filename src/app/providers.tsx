"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { createAppQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState<QueryClient>(createAppQueryClient);

  useEffect(() => {
    void useUiPreferencesStore.persist.rehydrate();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
