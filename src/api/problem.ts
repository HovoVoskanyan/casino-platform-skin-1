/**
 * The one error vocabulary the front switches on: identity's errorCodes (INVALID_CREDENTIALS, USER_ALREADY_REGISTERED,
 * LOCKED_OUT, TOTP_REQUIRED, …), payments' and bonus's, plus the edge's own — UNKNOWN_HOST, COUNTRY_BLOCKED (451),
 * SKIN_MISMATCH (403), RATE_LIMITED (429), UPSTREAM_UNAVAILABLE (502), ROUTE_NOT_FOUND (404). Anything else (network
 * down, HTML from a proxy) lands here as NETWORK / UNKNOWN so every mutation still gets a message.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errorCode?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = problem.errorCode ?? (status === 0 ? "NETWORK" : "UNKNOWN");
    this.problem = problem;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function toApiError(e: unknown): ApiError {
  if (isApiError(e)) return e;
  if (e instanceof Error) return new ApiError(0, { detail: e.message, errorCode: "NETWORK" });
  return new ApiError(0, { detail: String(e), errorCode: "UNKNOWN" });
}
