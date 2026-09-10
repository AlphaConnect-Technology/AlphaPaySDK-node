import type { Http } from "../http.js";
import type { CreateWalletTransferParams, ListParams, PaginatedList, WalletTransfer } from "../types.js";

export interface ListWalletTransfersParams extends ListParams {
  status?: string;
}

/**
 * Transferts entre les wallets multi-pays d'un même marchand (avec
 * conversion automatique si les devises diffèrent).
 *
 * ⚠️ **Entièrement inaccessible via clé API** — même restriction que
 * `SettlementsResource`, vérifiée en conditions réelles (403,
 * `code: "dashboard_only"`) : uniquement pilotable depuis le dashboard
 * (compte utilisateur), jamais une clé API.
 */
export class WalletTransfersResource {
  constructor(private readonly http: Http) {}

  list(params: ListWalletTransfersParams = {}): Promise<PaginatedList<WalletTransfer>> {
    return this.http.request("GET", "/wallet-transfers/", { query: params });
  }

  create(params: CreateWalletTransferParams, options: { idempotencyKey?: string | true } = {}): Promise<WalletTransfer> {
    return this.http.request("POST", "/wallet-transfers/", { body: params, idempotencyKey: options.idempotencyKey });
  }

  get(id: string): Promise<WalletTransfer> {
    return this.http.request("GET", `/wallet-transfers/${id}/`);
  }
}
