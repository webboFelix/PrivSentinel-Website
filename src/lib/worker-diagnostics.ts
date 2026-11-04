export async function diagnoseWorkerOperation<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  if (process.env.WORKER_DIAGNOSTICS !== "true") return run();

  const startedAt = Date.now();
  console.info("[worker-diagnostic]", { operation, state: "started" });
  try {
    const result = await run();
    console.info("[worker-diagnostic]", {
      operation,
      state: "completed",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    console.error("[worker-diagnostic]", {
      operation,
      state: "failed",
      durationMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }
}

export function diagnoseWorkerSyncOperation<T>(operation: string, run: () => T): T {
  if (process.env.WORKER_DIAGNOSTICS !== "true") return run();
  console.info("[worker-diagnostic]", { operation, state: "started" });
  try {
    const result = run();
    console.info("[worker-diagnostic]", { operation, state: "completed" });
    return result;
  } catch (error) {
    console.error("[worker-diagnostic]", {
      operation,
      state: "failed",
      errorType: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }
}
