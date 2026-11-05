"use client";

import { ErrorFallback } from "@/components/error-fallback";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ErrorFallback retry={retry} digest={error.digest} />
      </body>
    </html>
  );
}
