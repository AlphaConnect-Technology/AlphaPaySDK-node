import type { Http } from "../http.js";
import type { CheckoutSession, CreateCheckoutSessionParams, ListParams, PaginatedList } from "../types.js";

export interface ListCheckoutSessionsParams extends ListParams {
  status?: string;
}

/**
 * Sessions de checkout à usage unique — chacune génère sa propre page de
 * paiement hébergée (`checkout_url`), pré-remplie pour un client précis.
 * Contrairement à un lien de paiement réutilisable, une session correspond
 * à UNE tentative de paiement.
 */
export class CheckoutSessionsResource {
  constructor(private readonly http: Http) {}

  list(params: ListCheckoutSessionsParams = {}): Promise<PaginatedList<CheckoutSession>> {
    return this.http.request("GET", "/checkout-sessions/", { query: params });
  }

  create(params: CreateCheckoutSessionParams, options: { idempotencyKey?: string | true } = {}): Promise<CheckoutSession> {
    return this.http.request("POST", "/checkout-sessions/", { body: params, idempotencyKey: options.idempotencyKey });
  }

  get(id: string): Promise<CheckoutSession> {
    return this.http.request("GET", `/checkout-sessions/${id}/`);
  }

  cancel(id: string): Promise<CheckoutSession> {
    return this.http.request("POST", `/checkout-sessions/${id}/cancel/`);
  }
}
