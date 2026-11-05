export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const REQUEST_TIMEOUT_MS = 10_000;

function getErrorMessage(body: unknown, status: number) {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  if (status >= 500) return "The service is temporarily unavailable. Please try again shortly.";
  return `The request could not be completed (${status}).`;
}

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  const timeout = setTimeout(
    () => controller.abort(new DOMException("Request timed out.", "TimeoutError")),
    timeoutMs,
  );

  try {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (externalSignal?.aborted) throw error;
      if (controller.signal.aborted) {
        throw new ApiRequestError("The request took too long. Check your connection and try again.", 408);
      }
      throw new ApiRequestError("Unable to connect to the service. Check your connection and try again.", 0);
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      if (externalSignal?.aborted) throw new DOMException("Request was cancelled.", "AbortError");
      if (controller.signal.aborted) {
        throw new ApiRequestError("The request took too long. Check your connection and try again.", 408);
      }
      throw new ApiRequestError("The connection was interrupted while receiving the response. Please try again.", 0);
    }

    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiRequestError(
        response.ok
          ? "The service returned an invalid response. Please try again."
          : getErrorMessage(null, response.status),
        response.status,
      );
    }

    if (!response.ok) {
      throw new ApiRequestError(getErrorMessage(body, response.status), response.status);
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}
