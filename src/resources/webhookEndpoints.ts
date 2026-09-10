import { randomBytes } from "node:crypto";
import type { Http } from "../http.js";
import type { CreateWebhookParams, Environment, ListParams, MerchantWebhook, PaginatedList, WebhookEventType, WebhookLog } from "../types.js";

export interface MerchantWebhookSubscription {
  id: string;
  webhook: string;
  event_type: WebhookEventType;
  created_at: string;
}

export interface ListWebhookLogsParams extends ListParams {
  webhook?: string;
  status?: string;
  event_type?: string;
}

/**
 * Points de terminaison webhook du marchand (CRUD), les abonnements par
 * type d'événement, et l'historique des livraisons. Pour vérifier la
 * signature d'un webhook reçu, voir `verifyWebhookSignature` (export de
 * niveau racine, pas une méthode de cette ressource).
 *
 * Vérifié en conditions réelles : `list`/`get` (webhooks, abonnements,
 * journal) fonctionnent bien via clé API — mais **toute écriture est
 * dashboard-only** (403, `code: "dashboard_only"`) : `create`, `update`,
 * `rotateSecret`, `delete`, `subscriptions.subscribe/unsubscribe`,
 * `logs.resend`. Repérable individuellement ci-dessous.
 */
export class WebhookEndpointsResource {
  constructor(private readonly http: Http) {}

  list(params: ListParams = {}): Promise<PaginatedList<MerchantWebhook>> {
    return this.http.request("GET", "/merchant-webhooks/", { query: params });
  }

  /**
   * ⚠️ Dashboard-only — 403 via clé API.
   * `signing_secret` n'est présent en clair dans la réponse qu'à la création (ou après `rotateSecret`) — jamais récupérable ensuite.
   */
  create(params: CreateWebhookParams): Promise<MerchantWebhook> {
    return this.http.request("POST", "/merchant-webhooks/", { body: params });
  }

  get(id: string): Promise<MerchantWebhook> {
    return this.http.request("GET", `/merchant-webhooks/${id}/`);
  }

  /** ⚠️ Dashboard-only — 403 via clé API. */
  update(id: string, params: Partial<Pick<MerchantWebhook, "url" | "description" | "is_active">>): Promise<MerchantWebhook> {
    return this.http.request("PATCH", `/merchant-webhooks/${id}/`, { body: params });
  }

  /**
   * ⚠️ Dashboard-only — 403 via clé API.
   * Génère et renvoie un nouveau secret — l'ancien cesse immédiatement de
   * valider les signatures. Le secret est généré ICI, côté SDK, et envoyé
   * explicitement : un PATCH signing_secret vide ne régénère RIEN côté API
   * une fois qu'un secret existe déjà (il ne s'auto-génère qu'à la création
   * initiale) — cf. le même constat dans le dashboard AlphaPay
   * (Webhooks.tsx.generateSigningSecret).
   */
  rotateSecret(id: string): Promise<MerchantWebhook> {
    const signing_secret = randomBytes(32).toString("hex");
    return this.http.request("PATCH", `/merchant-webhooks/${id}/`, { body: { signing_secret } });
  }

  /** ⚠️ Dashboard-only — 403 via clé API. */
  delete(id: string): Promise<void> {
    return this.http.request("DELETE", `/merchant-webhooks/${id}/`);
  }

  subscriptions = {
    list: (params: ListParams & { webhook?: string } = {}): Promise<PaginatedList<MerchantWebhookSubscription>> =>
      this.http.request("GET", "/merchant-webhook-subscriptions/", { query: params }),

    /** ⚠️ Dashboard-only — 403 via clé API. */
    subscribe: (webhookId: string, eventType: WebhookEventType): Promise<MerchantWebhookSubscription> =>
      this.http.request("POST", "/merchant-webhook-subscriptions/", { body: { webhook: webhookId, event_type: eventType } }),

    /** ⚠️ Dashboard-only — 403 via clé API. */
    unsubscribe: (subscriptionId: string): Promise<void> =>
      this.http.request("DELETE", `/merchant-webhook-subscriptions/${subscriptionId}/`),
  };

  logs = {
    list: (params: ListWebhookLogsParams = {}): Promise<PaginatedList<WebhookLog>> =>
      this.http.request("GET", "/webhook-logs/", { query: params }),

    get: (id: string): Promise<WebhookLog> => this.http.request("GET", `/webhook-logs/${id}/`),

    /** ⚠️ Dashboard-only — 403 via clé API. Rejoue immédiatement cette livraison (nouvelle tentative hors du calendrier de retry automatique). */
    resend: (id: string): Promise<WebhookLog> => this.http.request("POST", `/webhook-logs/${id}/resend/`),
  };
}

export type { Environment };
