import type { Http } from "../http.js";
import type {
  CreatePaymentLinkParams,
  CreatePublicCheckoutParams,
  ListParams,
  PaginatedList,
  PaymentLink,
  PublicCheckoutResult,
  PublicPaymentLink,
} from "../types.js";

export interface ListPaymentLinksParams extends ListParams {
  is_active?: boolean;
}

export class PaymentLinksResource {
  constructor(private readonly http: Http) {}

  list(params: ListPaymentLinksParams = {}): Promise<PaginatedList<PaymentLink>> {
    return this.http.request("GET", "/payment-links/", { query: params });
  }

  create(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    return this.http.request("POST", "/payment-links/", { body: params });
  }

  get(id: string): Promise<PaymentLink> {
    return this.http.request("GET", `/payment-links/${id}/`);
  }

  update(id: string, params: Partial<CreatePaymentLinkParams> & { is_active?: boolean }): Promise<PaymentLink> {
    return this.http.request("PATCH", `/payment-links/${id}/`, { body: params });
  }

  delete(id: string): Promise<void> {
    return this.http.request("DELETE", `/payment-links/${id}/`);
  }

  /**
   * Consultation publique (page de paiement du lien) — pas d'auth marchand,
   * `slug` fait office de capacité. Utile pour prévisualiser son propre lien,
   * mais surtout destiné à un front public (jamais la clé secrète côté client).
   */
  getPublic(slug: string): Promise<PublicPaymentLink> {
    return this.http.request("GET", `/payment-links/public/${slug}/`);
  }

  /**
   * Crée une CheckoutSession one-shot à partir du lien (montant + identité
   * client) — un lien étant réutilisable, chaque appel en crée une NOUVELLE.
   * Ni pays ni réseau ici : ça se choisit ensuite sur la page checkout,
   * pilotable avec le SDK checkout public (mobile/web) via le `slug` renvoyé.
   */
  createPublicCheckout(slug: string, params: CreatePublicCheckoutParams): Promise<PublicCheckoutResult> {
    return this.http.request("POST", `/payment-links/public/${slug}/checkout/`, { body: params });
  }
}
