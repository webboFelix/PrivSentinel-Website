"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useUiPreferencesStore } from "@/stores/ui-preferences-store";
import { createAppQueryClient, shouldPersistQuery } from "@/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState<QueryClient>(createAppQueryClient);

  useEffect(() => {
    void useUiPreferencesStore.persist.rehydrate();

    if (typeof window === "undefined") return undefined;

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "privsentinel-query-cache",
    });

    const [unsubscribe, restorePromise] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey),
      },
    });

    void restorePromise;
    return unsubscribe;
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
