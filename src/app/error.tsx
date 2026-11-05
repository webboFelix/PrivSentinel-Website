"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorFallback retry={retry} digest={error.digest} />;
}
