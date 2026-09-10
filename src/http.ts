import { AlphaPayConnectionError, AlphaPayRateLimitError, AlphaPayServerError, buildErrorFromResponse } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.alphapay.me/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export interface AlphaPayClientOptions {
  /** Clé secrète marchand — `sk_live_xxx` ou `sk_test_xxx` (cf. dashboard AlphaPay > Clés API). */
  apiKey: string;
  /**
   * Override de l'URL de base — utile en dev/self-hosted uniquement.
   * Par défaut : `https://api.alphapay.me/api/v1`.
   */
  baseUrl?: string;
  /** Délai avant abandon d'une requête, en ms (défaut 30000). */
  timeout?: number;
  /** Nombre de tentatives supplémentaires sur erreur réseau/429/5xx (défaut 2 — donc 3 tentatives au total). */
  maxRetries?: number;
  /** Injecte un fetch personnalisé (tests, environnements sans fetch global). */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  // `object` plutôt que `Record<string, ...>` : les interfaces de paramètres
  // de chaque ressource (ListTransactionsParams etc.) n'ont pas d'index
  // signature déclarée, donc pas structurellement assignables à un Record —
  // `object` accepte toute forme d'objet, la validation des valeurs reste
  // entièrement à la charge des types publics de chaque ressource.
  query?: object;
  body?: unknown;
  /**
   * Clé d'idempotence pour cette requête — recommandé sur toute création qui
   * déplace de l'argent réel (payin, payout, reversement, transfert wallet).
   * `true` génère une clé aléatoire automatiquement ; une chaîne l'impose.
   * Cf. apps.core.mixins.IdempotencyMixin côté API (header optionnel).
   */
  idempotencyKey?: string | true;
  signal?: AbortSignal;
}

/** true si la clé fournie commence par le préfixe live — sinon on suppose sandbox. */
function isLiveKey(apiKey: string): boolean {
  return apiKey.startsWith("sk_live_");
}

function randomIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback pour un runtime sans crypto.randomUUID (Node < 19 sans flag) — suffisant
  // pour une clé d'idempotence à usage unique, pas un besoin cryptographique.
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function buildQueryString(query: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function backoffMs(attempt: number): number {
  // Backoff exponentiel + gigue : 400-600ms, 800-1200ms, 1600-2400ms...
  const base = 400 * 2 ** attempt;
  return base + Math.random() * base * 0.5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** fetch échoue en TypeError sur erreur réseau/DNS (spec WHATWG) — jamais un statut HTTP, donc jamais couvert par buildErrorFromResponse. */
function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** Timeout interne (AbortController déclenché par `this.timeout`, pas par un signal externe fourni par l'appelant). */
function isInternalTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Client HTTP bas niveau, partagé par toutes les ressources. Gère
 * l'authentification, l'enveloppe standard `{success, data, code}`, les
 * retries avec backoff sur 429/5xx/erreurs réseau, et le mapping vers des
 * erreurs typées (cf. errors.ts) — chaque méthode de ressource (transactions,
 * paymentLinks, ...) n'a plus qu'à décrire le endpoint, jamais la mécanique
 * réseau.
 */
export class Http {
  readonly baseUrl: string;
  readonly environment: "live" | "sandbox";
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AlphaPayClientOptions) {
    if (!options.apiKey) throw new Error("AlphaPayClient: `apiKey` est requis.");
    this.apiKey = options.apiKey;
    this.environment = isLiveKey(options.apiKey) ? "live" : "sandbox";
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new Error(
        "AlphaPayClient: aucun `fetch` global trouvé (Node < 18 ?) — passez `fetch` explicitement dans les options."
      );
    }
    this.fetchImpl = fetchImpl;
  }

  async request<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, options: RequestOptions = {}): Promise<T> {
    // `path` est une URL absolue quand on suit un lien `next`/`previous`
    // renvoyé tel quel par l'API (cf. paginate()) — déjà complète, avec sa
    // propre query string ; ne JAMAIS la préfixer par baseUrl ni y rajouter
    // `options.query` par-dessus (ça doublonnerait des paramètres déjà présents).
    const url = /^https?:\/\//.test(path) ? path : `${this.baseUrl}${path}${buildQueryString(options.query)}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey === true ? randomIdempotencyKey() : options.idempotencyKey;
    }

    for (let attempt = 0; ; attempt++) {
      const isLastAttempt = attempt >= this.maxRetries;
      const internalTimeout = new AbortController();
      const timeoutId = setTimeout(() => internalTimeout.abort(), this.timeout);
      const onExternalAbort = () => internalTimeout.abort();
      options.signal?.addEventListener("abort", onExternalAbort);

      try {
        const response = await this.fetchImpl(url, { method, headers, body, signal: internalTimeout.signal });
        return await this.parseResponse<T>(response);
      } catch (err) {
        // Annulation volontaire par l'appelant (jamais retentée, contrairement à un timeout interne).
        if (options.signal?.aborted) throw err;

        const retryable =
          err instanceof AlphaPayRateLimitError ||
          err instanceof AlphaPayServerError ||
          isNetworkError(err) ||
          isInternalTimeout(err);

        if (!retryable || isLastAttempt) {
          if (isInternalTimeout(err)) {
            throw new AlphaPayConnectionError(`Requête AlphaPay expirée après ${this.timeout}ms.`, { status: 0, raw: err });
          }
          if (isNetworkError(err)) {
            throw new AlphaPayConnectionError(`Impossible de joindre l'API AlphaPay : ${(err as Error).message}`, {
              status: 0,
              raw: err,
            });
          }
          throw err;
        }

        const retryAfterMs = err instanceof AlphaPayRateLimitError && err.retryAfter ? err.retryAfter * 1000 : backoffMs(attempt);
        await sleep(retryAfterMs);
      } finally {
        clearTimeout(timeoutId);
        options.signal?.removeEventListener("abort", onExternalAbort);
      }
    }
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const requestId = response.headers.get("X-Request-Id") ?? undefined;
    const text = await response.text();
    let json: unknown;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // Réponse non-JSON (page d'erreur d'un proxy en amont, ex. 502 Traefik) — traité
        // ci-dessous comme un succès sans corps, ou une erreur serveur au message générique.
      }
    }

    if (response.ok) {
      const envelope = json as { data?: T } | undefined;
      return (envelope && typeof envelope === "object" && "data" in envelope ? envelope.data : json) as T;
    }

    const envelope = json as { error?: unknown } | undefined;
    const errorBody = envelope && typeof envelope === "object" && "error" in envelope ? envelope.error : json;
    const error = buildErrorFromResponse(response.status, errorBody, requestId);

    if (error instanceof AlphaPayRateLimitError) {
      const header = response.headers.get("Retry-After");
      if (header) (error as { retryAfter?: number }).retryAfter = Number(header);
    }
    throw error;
  }

  /**
   * Pour les rares endpoints qui répondent en binaire plutôt qu'en JSON
   * (ex. GET /transactions/{id}/invoice/, application/pdf) — bypass
   * l'enveloppe standard, jamais utilisée par un endpoint qui en renvoie une.
   */
  async requestBinary(path: string): Promise<{ data: ArrayBuffer; contentType: string | null; filename: string | null }> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/pdf, application/octet-stream" },
    });
    if (!response.ok) {
      // Une erreur sur cet endpoint reste en JSON (cf. InvoiceError côté API) — on retombe
      // sur le chemin JSON normal pour un message d'erreur exploitable plutôt que du binaire
      // brut. `parseResponse` lève toujours sur une réponse non-ok — jamais un retour normal.
      await this.parseResponse<never>(response);
    }
    const disposition = response.headers.get("Content-Disposition") ?? "";
    const filenameMatch = /filename="?([^"]+)"?/.exec(disposition);
    return {
      data: await response.arrayBuffer(),
      contentType: response.headers.get("Content-Type"),
      filename: filenameMatch?.[1] ?? null,
    };
  }
}
