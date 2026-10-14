import type { Http } from "../http.js";
import type { CreateWalletTransferParams, ListParams, PaginatedList, WalletTransfer, WalletTransferStatus } from "../types.js";

export interface ListWalletTransfersParams extends ListParams {
  status?: WalletTransferStatus;
  /** Code ISO2 (ex. "BJ"). */
  from_country?: string;
  /** Code ISO2 (ex. "CM"). */
  to_country?: string;
}

/**
 * Transferts entre les wallets multi-pays d'un même marchand (avec
 * conversion automatique si les devises diffèrent). L'argent ne quitte
 * jamais la plateforme — usage typique : approvisionner le wallet du pays
 * d'un bénéficiaire avant un payout Mobile Money.
 *
 * Accessible via clé API depuis le 2026-09-24 (auparavant 403
 * `dashboard_only`) :
 * - `create()` exige une clé de scope `PAYOUT` ou `BOTH` — une clé `PAYIN`
 *   reçoit un `AlphaPayPermissionError`, `code: "api_key_scope_forbidden"`.
 * - `list()`/`get()` : toute clé du marchand.
 *
 * Cycle de vie : `PENDING` → `COMPLETED` ou `REJECTED`. Un transfert n'est
 * `COMPLETED` immédiatement que si l'auto-approbation est activée pour le
 * marchand (réglage AlphaPay, `auto_approved_via` = `"GLOBAL"`/`"MERCHANT"`) ;
 * sinon il reste `PENDING` jusqu'à validation par un admin AlphaPay — suivez
 * les webhooks `wallet_transfer.completed`/`.rejected` plutôt que
 * d'interroger `get()` en boucle.
 */
export class WalletTransfersResource {
  constructor(private readonly http: Http) {}

  list(params: ListWalletTransfersParams = {}): Promise<PaginatedList<WalletTransfer>> {
    return this.http.request("GET", "/wallet-transfers/", { query: params });
  }

  /**
   * Réserve `from_amount` sur le wallet source. `idempotencyKey` fortement
   * recommandée (`true` en génère une) : sans elle, un retry réseau
   * réserverait deux fois le montant. Réutiliser une clé avec un contenu
   * différent lève `AlphaPayIdempotencyError` (409).
   *
   * Refus métier → `AlphaPayValidationError` (422), `code` :
   * `"same_country"`, `"transfer_already_pending"` (un seul transfert
   * `PENDING` à la fois par marchand), `"wallet_frozen"`, `"insufficient_balance"`.
   */
  create(params: CreateWalletTransferParams, options: { idempotencyKey?: string | true } = {}): Promise<WalletTransfer> {
    return this.http.request("POST", "/wallet-transfers/", { body: params, idempotencyKey: options.idempotencyKey });
  }

  get(id: string): Promise<WalletTransfer> {
    return this.http.request("GET", `/wallet-transfers/${id}/`);
  }
}
