import type { Http } from "../http.js";
import type { CreateSettlementParams, ListParams, PaginatedList, Settlement } from "../types.js";

export interface ListSettlementsParams extends ListParams {
  status?: string;
  country?: string;
}

/**
 * Reversements (retraits vers un compte bancaire ou mobile money enregistré)
 * — cf. WalletTransfersResource pour un transfert entre wallets AlphaPay.
 *
 * ⚠️ **Entièrement inaccessible via clé API** (`sk_live_.../sk_test_...`), y
 * compris en LECTURE — toutes les méthodes de cette ressource lèvent
 * systématiquement une `AlphaPayPermissionError` (403, `code:
 * "dashboard_only"`) avec ce type d'auth. Restriction volontaire côté API
 * (`apps.core.mixins.forbid_api_key`, vérifiée contre le code réel) : un
 * retrait ne peut être déclenché ou consulté que par un compte utilisateur
 * connecté au dashboard, jamais par une clé API — même la vôtre. Cette
 * ressource ne peut donc pas servir à une intégration serveur automatisée ;
 * elle reste dans le SDK pour rester honnête sur la forme des endpoints,
 * pas pour un usage réel avec ce client.
 */
export class SettlementsResource {
  constructor(private readonly http: Http) {}

  list(params: ListSettlementsParams = {}): Promise<PaginatedList<Settlement>> {
    return this.http.request("GET", "/settlements/", { query: params });
  }

  /** Débite le solde disponible du pays concerné dès la création — recommandé avec `idempotencyKey`. */
  create(params: CreateSettlementParams, options: { idempotencyKey?: string | true } = {}): Promise<Settlement> {
    return this.http.request("POST", "/settlements/", { body: params, idempotencyKey: options.idempotencyKey });
  }

  get(id: string): Promise<Settlement> {
    return this.http.request("GET", `/settlements/${id}/`);
  }

  /** Uniquement possible tant que le reversement est PENDING. */
  cancel(id: string): Promise<Settlement> {
    return this.http.request("POST", `/settlements/${id}/cancel/`);
  }
}
