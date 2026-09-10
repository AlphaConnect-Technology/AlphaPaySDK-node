import type { Http } from "../http.js";
import type {
  CursorPaginatedList,
  PayoutInitializeParams,
  PayoutInitializeResult,
  SoftpayInitializeParams,
  SoftpayInitializeResult,
  Transaction,
  TransactionDetail,
  VerifyResult,
} from "../types.js";

/**
 * PAS `extends ListParams` — TransactionListView est paginée par curseur
 * (apps.transactions.views.transaction, pagination_class =
 * CreatedAtCursorPagination), `page` n'a donc aucun effet ici (vérifié
 * contre l'API réelle, pas supposé) : seuls `next`/`previous` (via
 * `paginate()`) font avancer la liste.
 */
export interface ListTransactionsParams {
  page_size?: number;
  search?: string;
  status?: string;
  transaction_type?: string;
  flow_direction?: "INBOUND" | "OUTBOUND";
  country?: string;
  network?: string;
  customer?: string;
  created_at__gte?: string;
  created_at__lte?: string;
}

/**
 * Paiements (encaissements), retraits (payouts) et leur historique.
 * `payin`/`payout` sont volontairement séparés du CRUD `list`/`get` — ce
 * sont des actions (initier un mouvement d'argent), pas des ressources REST
 * classiques, cf. /payments/*​ et /payouts/*​ côté API.
 */
export class TransactionsResource {
  constructor(private readonly http: Http) {}

  list(params: ListTransactionsParams = {}): Promise<CursorPaginatedList<Transaction>> {
    return this.http.request("GET", "/transactions/", { query: params });
  }

  get(id: string): Promise<TransactionDetail> {
    return this.http.request("GET", `/transactions/${id}/`);
  }

  /**
   * Télécharge la facture PDF — réponse binaire authentifiée (pas de simple
   * URL publique à partager telle quelle), 409 hors INBOUND+SUCCESS (cf.
   * apps.transactions.services.invoice.generate_invoice_pdf).
   */
  async downloadInvoice(id: string): Promise<{ data: ArrayBuffer; filename: string | null }> {
    const { data, filename } = await this.http.requestBinary(`/transactions/${id}/invoice/`);
    return { data, filename };
  }

  /** Export CSV — mêmes filtres que `list()`, sans limite de lignes ni pagination. */
  async export(params: ListTransactionsParams = {}): Promise<{ data: ArrayBuffer; filename: string | null }> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) query.set(key, String(value));
    }
    const qs = query.toString();
    const { data, filename } = await this.http.requestBinary(`/transactions/export/${qs ? `?${qs}` : ""}`);
    return { data, filename };
  }

  payin = {
    /**
     * Encaisse directement (push USSD/mobile money) sans page de checkout à
     * suivre. Une `idempotencyKey` est fortement recommandée : un doublon
     * pousse un second prompt de paiement vers le client final.
     */
    initialize: (params: SoftpayInitializeParams, options: { idempotencyKey?: string | true } = {}): Promise<SoftpayInitializeResult> =>
      this.http.request("POST", "/payments/softpay/", { body: params, idempotencyKey: options.idempotencyKey }),

    verify: (paymentId: string): Promise<VerifyResult> => this.http.request("GET", `/payments/${paymentId}/verify/`),

    retry: (paymentId: string, params: { preferred_gateway?: string } = {}, options: { idempotencyKey?: string | true } = {}): Promise<VerifyResult> =>
      this.http.request("POST", `/payments/${paymentId}/retry/`, { body: params, idempotencyKey: options.idempotencyKey }),

    /** Réseaux exigeant une confirmation en 2 temps (ex. Wizall Sénégal, Coris Bénin). */
    confirmOtp: (paymentId: string, otp: string): Promise<VerifyResult> =>
      this.http.request("POST", `/payments/${paymentId}/confirm-otp/`, { body: { otp } }),
  };

  payout = {
    /**
     * Déclenche un retrait — débite immédiatement le wallet marchand
     * (réservation de solde). `idempotencyKey` fortement recommandée : sans
     * elle, un doublon débite deux fois le MÊME wallet.
     */
    initialize: (params: PayoutInitializeParams, options: { idempotencyKey?: string | true } = {}): Promise<PayoutInitializeResult> =>
      this.http.request("POST", "/payouts/initialize/", { body: params, idempotencyKey: options.idempotencyKey }),

    verify: (payoutId: string): Promise<VerifyResult> => this.http.request("GET", `/payouts/${payoutId}/verify/`),
  };
}
