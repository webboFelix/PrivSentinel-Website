import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "@/lib/client-api";

export const persistedPublicQueryKeys = [
  ["releases"],
  ["testimonials", "approved"],
] as const;

export function shouldPersistQuery(key: readonly unknown[]) {
  return persistedPublicQueryKeys.some((persistedKey) => persistedKey.length === key.length && persistedKey.every((segment, index) => segment === key[index]));
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError && (error.status === 0 || error.status === 408)) return false;
          if (error instanceof ApiRequestError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}
