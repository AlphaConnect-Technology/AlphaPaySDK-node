import type { Http } from "../http.js";
import type { CreatePaymentLinkParams, ListParams, PaginatedList, PaymentLink } from "../types.js";

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
}
