import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookEvent } from "./types.js";

/** Fenêtre de tolérance par défaut, en secondes — même valeur que côté API (apps.webhooks.services.SIGNATURE_TOLERANCE_SECONDS). */
const DEFAULT_TOLERANCE_SECONDS = 300;

export class AlphaPayWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlphaPayWebhookSignatureError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface VerifyWebhookOptions {
  /** Corps BRUT de la requête (chaîne exacte reçue, avant tout JSON.parse — la signature porte sur les octets exacts envoyés). */
  payload: string | Buffer;
  /** Valeur du header `X-Webhook-Signature`. */
  signature: string;
  /** Valeur du header `X-Webhook-Timestamp`. */
  timestamp: string | number;
  /** Secret de signature du webhook (visible une seule fois à la création/rotation dans le dashboard AlphaPay). */
  secret: string;
  /** Fenêtre d'acceptation en secondes (défaut 300, comme recommandé par l'API). */
  toleranceSeconds?: number;
}

/**
 * Vérifie qu'un webhook provient bien d'AlphaPay et n'a pas été rejoué.
 *
 * Reproduit exactement apps.webhooks.services.sign_payload côté API :
 * HMAC-SHA256 de `"<timestamp>.<corps>"`, comparé en temps constant pour ne
 * jamais fuiter d'information via le timing de la comparaison.
 *
 * @throws {AlphaPayWebhookSignatureError} si la signature est invalide ou le
 *   timestamp hors fenêtre de tolérance (rejeu).
 * @returns L'événement typé, déjà parsé — jamais retourné avant vérification
 *   de la signature (n'appelez jamais JSON.parse(payload) vous-même avant ce
 *   contrôle : ce serait traiter un webhook non authentifié).
 */
export function verifyWebhookSignature<T = Record<string, unknown>>(options: VerifyWebhookOptions): WebhookEvent<T> {
  const { payload, signature, timestamp, secret, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS } = options;

  const ts = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  if (!Number.isFinite(ts)) {
    throw new AlphaPayWebhookSignatureError(`Timestamp de webhook invalide : "${timestamp}".`);
  }

  const rawBody = typeof payload === "string" ? payload : payload.toString("utf8");
  const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");

  if (!safeCompare(expected, signature)) {
    throw new AlphaPayWebhookSignatureError("Signature de webhook invalide — vérifiez le secret utilisé.");
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - ts);
  if (ageSeconds > toleranceSeconds) {
    throw new AlphaPayWebhookSignatureError(
      `Timestamp de webhook hors fenêtre de tolérance (${Math.round(ageSeconds)}s, limite ${toleranceSeconds}s) — rejeu potentiel.`
    );
  }

  try {
    return JSON.parse(rawBody) as WebhookEvent<T>;
  } catch {
    throw new AlphaPayWebhookSignatureError("Corps de webhook signé valide mais illisible (JSON invalide).");
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  // Longueurs différentes : timingSafeEqual lèverait — pas de fuite de timing
  // supplémentaire à comparer un buffer factice de même taille avant de renvoyer false.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
