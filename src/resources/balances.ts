import type { Http } from "../http.js";
import type { ListParams, MerchantBalance, MerchantLedgerEntry, PaginatedList } from "../types.js";

export interface ListLedgerEntriesParams extends ListParams {
  country?: string;
  created_at__gte?: string;
  created_at__lte?: string;
}

/** Soldes par pays/devise et grand livre des mouvements — lecture seule (les mouvements naissent des autres ressources : transactions, reversements, transferts). */
export class BalancesResource {
  constructor(private readonly http: Http) {}

  list(params: ListParams = {}): Promise<PaginatedList<MerchantBalance>> {
    return this.http.request("GET", "/merchant-balances/", { query: params });
  }

  get(id: string): Promise<MerchantBalance> {
    return this.http.request("GET", `/merchant-balances/${id}/`);
  }

  /**
   * ⚠️ **Inaccessible via clé API** (contrairement à `list()`/`get()`
   * ci-dessus, qui fonctionnent bien avec une clé — vérifié en conditions
   * réelles) : lève systématiquement `AlphaPayPermissionError` (403,
   * `code: "dashboard_only"`). Le grand livre détaillé n'est consultable
   * que depuis le dashboard (compte utilisateur).
   */
  ledgerEntries(params: ListLedgerEntriesParams = {}): Promise<PaginatedList<MerchantLedgerEntry>> {
    return this.http.request("GET", "/merchant-ledger-entries/", { query: params });
  }
}
