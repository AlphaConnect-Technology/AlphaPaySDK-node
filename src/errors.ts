/**
 * Toute erreur API passe par `apps.core.renderers.StandardJSONRenderer` :
 * {"success": false, "error": <forme variable — voir ci-dessous>, "code": <statut HTTP>}.
 * `error` n'a PAS une forme unique dans l'API AlphaPayBack actuelle :
 *   - erreurs de validation DRF   → {"<champ>": ["message", ...], ...}
 *   - erreurs métier personnalisées → {"message": "...", "code": "<code_machine>"}
 *   - erreurs d'authentification  → {"detail": "..."}
 * `AlphaPayError.message` normalise ces trois formes en une seule chaîne
 * lisible ; `.raw` garde la forme originale pour qui a besoin du détail par champ.
 */
export class AlphaPayError extends Error {
  /** Statut HTTP de la réponse. */
  readonly status: number;
  /** Code machine, quand l'API en fournit un (ex. "invalid_file_type") — absent sur les erreurs de validation par champ. */
  readonly code?: string;
  /** Corps d'erreur brut, tel que renvoyé par l'API. */
  readonly raw: unknown;
  /** Présent uniquement sur une erreur de validation DRF ({"champ": [...]})  . */
  readonly fieldErrors?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(message: string, options: { status: number; code?: string; raw?: unknown; fieldErrors?: Record<string, string[]>; requestId?: string }) {
    super(message);
    this.name = "AlphaPayError";
    this.status = options.status;
    this.code = options.code;
    this.raw = options.raw;
    this.fieldErrors = options.fieldErrors;
    this.requestId = options.requestId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AlphaPayAuthenticationError extends AlphaPayError {}
export class AlphaPayPermissionError extends AlphaPayError {}
export class AlphaPayNotFoundError extends AlphaPayError {}
export class AlphaPayValidationError extends AlphaPayError {}
export class AlphaPayRateLimitError extends AlphaPayError {
  /** Secondes à attendre avant de réessayer, quand l'API le précise (header Retry-After). */
  readonly retryAfter?: number;

  constructor(message: string, options: ConstructorParameters<typeof AlphaPayError>[1] & { retryAfter?: number }) {
    super(message, options);
    this.retryAfter = options.retryAfter;
  }
}
export class AlphaPayServerError extends AlphaPayError {}
/** Connexion/DNS/timeout — jamais atteint le serveur AlphaPay, `status` vaut 0. */
export class AlphaPayConnectionError extends AlphaPayError {}
/** 409 Idempotency-Key réutilisée avec un payload différent (cf. apps.core.mixins.IdempotencyMixin). */
export class AlphaPayIdempotencyError extends AlphaPayError {}

/**
 * Construit l'erreur normalisée à partir de la réponse HTTP. `body` est déjà
 * le contenu de la clé "error" de l'enveloppe (pas l'enveloppe entière).
 */
export function buildErrorFromResponse(status: number, body: unknown, requestId?: string): AlphaPayError {
  const { message, code, fieldErrors } = interpretErrorBody(body);
  const options = { status, code, raw: body, fieldErrors, requestId };

  if (status === 401) return new AlphaPayAuthenticationError(message, options);
  if (status === 403) return new AlphaPayPermissionError(message, options);
  if (status === 404) return new AlphaPayNotFoundError(message, options);
  if (status === 409) return new AlphaPayIdempotencyError(message, options);
  if (status === 429) return new AlphaPayRateLimitError(message, options);
  if (status === 400 || status === 422) return new AlphaPayValidationError(message, options);
  if (status >= 500) return new AlphaPayServerError(message, options);
  return new AlphaPayError(message, options);
}

function interpretErrorBody(body: unknown): { message: string; code?: string; fieldErrors?: Record<string, string[]> } {
  if (body == null) return { message: "Erreur AlphaPay inconnue." };
  if (typeof body === "string") return { message: body };

  if (typeof body === "object") {
    const obj = body as Record<string, unknown>;

    // {"message": "...", "code": "..."} — erreurs métier personnalisées.
    if (typeof obj.message === "string") {
      return { message: obj.message, code: typeof obj.code === "string" ? obj.code : undefined };
    }
    // {"detail": "..."} — erreurs d'auth/permission DRF standard.
    if (typeof obj.detail === "string") {
      return { message: obj.detail };
    }
    // {"champ": ["erreur", ...], ...} — erreurs de validation DRF.
    const fieldErrors: Record<string, string[]> = {};
    let hasFieldErrors = false;
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        fieldErrors[key] = value as string[];
        hasFieldErrors = true;
      }
    }
    if (hasFieldErrors) {
      const summary = Object.entries(fieldErrors)
        .map(([field, errs]) => `${field}: ${errs.join(", ")}`)
        .join(" — ");
      return { message: summary, fieldErrors };
    }
  }

  return { message: "Erreur AlphaPay inconnue.", code: undefined };
}
