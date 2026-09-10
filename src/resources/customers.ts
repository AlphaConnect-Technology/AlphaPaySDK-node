import type { Http } from "../http.js";
import type { Customer, ListParams, PaginatedList, Transaction, UpsertCustomerParams } from "../types.js";
import type { ListTransactionsParams } from "./transactions.js";

export class CustomersResource {
  constructor(private readonly http: Http) {}

  list(params: ListParams = {}): Promise<PaginatedList<Customer>> {
    return this.http.request("GET", "/customers/", { query: params });
  }

  create(params: UpsertCustomerParams): Promise<Customer> {
    return this.http.request("POST", "/customers/", { body: params });
  }

  get(id: string): Promise<Customer> {
    return this.http.request("GET", `/customers/${id}/`);
  }

  update(id: string, params: Partial<UpsertCustomerParams>): Promise<Customer> {
    return this.http.request("PATCH", `/customers/${id}/`, { body: params });
  }

  delete(id: string): Promise<void> {
    return this.http.request("DELETE", `/customers/${id}/`);
  }

  /**
   * Contrairement à `transactions.list()`, cet endpoint EST paginé par page
   * (`page` fonctionne ici) — c'est `CustomerTransactionsView`, sans
   * `pagination_class` propre, qui retombe donc sur le défaut global
   * `StandardResultsPagination`, pas `CreatedAtCursorPagination`.
   */
  transactions(id: string, params: ListTransactionsParams & { page?: number } = {}): Promise<PaginatedList<Transaction>> {
    return this.http.request("GET", `/customers/${id}/transactions/`, { query: params });
  }
}
