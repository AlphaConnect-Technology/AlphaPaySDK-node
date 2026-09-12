/**
 * Types partagés — reflètent le schéma OpenAPI généré depuis AlphaPayBack
 * (drf-spectacular, `apps.core.openapi`). Toute réponse HTTP de l'API passe
 * par `apps.core.renderers.StandardJSONRenderer` :
 *   succès → {"success": true, "data": <T>, "code": <statut HTTP>}
 *   échec  → {"success": false, "error": <forme variable>, "code": <statut>}
 * Le client (`Http`) déballe déjà `data` — ces types décrivent ce qui reste
 * après déballage, jamais l'enveloppe elle-même.
 */

/** Pagination par page — endpoint sur apps.core.pagination.StandardResultsPagination (le défaut). */
export interface PaginatedList<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Pagination par curseur — PAS de `count` (coûteux à calculer sur une table
 * volumineuse en croissance continue), et `page` n'a aucun effet : seul
 * `next`/`previous` (URLs absolues renvoyées par l'API) font avancer la
 * liste, cf. `paginate()`. Utilisé par TransactionsResource.list()
 * spécifiquement (apps.transactions.views.transaction.TransactionListView),
 * PAS par le reste de l'API — vérifié contre apps.core.pagination et les
 * `pagination_class` réellement déclarées côté AlphaPayBack, pas supposé.
 */
export interface CursorPaginatedList<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Options de listing communes à toutes les ressources paginées par page. */
export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
}

export type Environment = "live" | "sandbox";

export type FeeChargeMode = "ADD_ON" | "DEDUCTED";

export type TransactionStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
export type FlowDirection = "INBOUND" | "OUTBOUND";

export interface TransactionAmounts {
  requested: string;
  fee: string;
  charged: string;
  net: string;
  currency: string;
  fee_charge_mode: FeeChargeMode;
}

export interface Transaction {
  id: string;
  reference: string;
  merchant: string;
  customer: string;
  country: string;
  country_code: string;
  network: string;
  network_code: string;
  transaction_type: string;
  flow_direction: FlowDirection;
  description?: string;
  requested_amount: string;
  fee_charge_mode: FeeChargeMode;
  client_fee?: string;
  gateway_fee?: string;
  platform_fee?: string;
  pricing_rule?: string | null;
  merchant_pricing_rule?: string | null;
  checkout_session?: string | null;
  debited_amount: string;
  net_amount: string;
  currency: string;
  status?: TransactionStatus;
  current_gateway?: string | null;
  external_reference: string;
  ip_address: string | null;
  operation_msisdn: string;
  metadata: Record<string, unknown> | null;
  /** Ventilation prête à afficher (cf. TransactionSerializer.get_amounts côté API). */
  amounts: TransactionAmounts;
  created_at: string;
  updated_at: string;
}

export interface TransactionStatusLogEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
}

export interface TransactionDetail extends Transaction {
  /** Forme dépend du rôle de l'appelant côté API (admin vs marchand) — jamais garantie ici. */
  attempts: unknown;
  status_logs: TransactionStatusLogEntry[];
  /** Consigne d'action pour le client final (USSD à composer, etc.) — vide si un simple push suffit. */
  instructions: unknown;
}

/** Réponse de POST /payments/softpay/ — PAS un Transaction complet. */
export interface SoftpayInitializeResult {
  message: string;
  id: string;
  status: TransactionStatus;
  /** Non-vide seulement si le réseau choisi retombe sur une redirection plutôt qu'un push direct. */
  checkout_url: string;
  instructions: unknown;
}

/** Réponse de POST /payouts/initialize/. */
export interface PayoutInitializeResult {
  message: string;
  id: string;
}

/** Réponse de GET /payments/{id}/verify/ et GET /payouts/{id}/verify/. */
export interface VerifyResult extends Transaction {
  message: string;
  instructions?: unknown;
}

/**
 * Identité du client pour un push softpay direct — cf.
 * `apps.transactions.serializers.checkout.SoftpayCustomerSerializer` : les
 * 4 champs sont TOUS obligatoires (pas de page hébergée où le client les
 * saisirait lui-même après coup, contrairement à une CheckoutSession).
 * Il n'y a PAS de champ `full_name` côté API — un ancien exemple de ce SDK
 * l'utilisait par erreur, jamais accepté par le serveur.
 */
export interface SoftpayCustomer {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
}

/**
 * Identité du client pour un payout — cf. `PayoutInitializeSerializer.customer`
 * (`CustomerCheckoutSerializer`) : email/prénom/nom requis, téléphone optionnel
 * (c'est `recipient.msisdn` ci-dessous qui porte le numéro à créditer).
 */
export interface PayoutCustomer {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface SoftpayInitializeParams {
  /** Requis pour un JWT dashboard multi-marchand ; ignoré pour une auth par clé API (déjà scopée à un marchand). */
  merchant?: string;
  amount: string | number;
  currency: string;
  /** Code ISO du pays (ex. "BJ"). */
  country: string;
  description?: string;
  customer: SoftpayCustomer;
  /** Code réseau (ex. "mtn_bj") — cf. GET /networks/. */
  network: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
  fee_charge_mode?: FeeChargeMode | null;
  preferred_gateway?: string;
  /** Requis pour les réseaux exigeant un OTP dès l'initialisation. */
  otp?: string;
}

/**
 * Destinataire du retrait — cf. `RecipientSerializer` : un SEUL champ,
 * `msisdn`. Un ancien exemple de ce SDK inventait `full_name`/`account_number`/
 * `bank_name`, jamais reconnus par l'API (c'est `customer` ci-dessus qui
 * porte l'identité, `method` qui porte le réseau/la banque).
 */
export interface PayoutRecipient {
  msisdn: string;
}

export interface PayoutInitializeParams {
  merchant?: string;
  amount: string | number;
  currency: string;
  country: string;
  description?: string;
  customer: PayoutCustomer;
  metadata?: Record<string, unknown>;
  /** Code de méthode de retrait (réseau mobile money ou "BANK_TRANSFER"). */
  method: string;
  recipient: PayoutRecipient;
  fee_charge_mode?: FeeChargeMode | null;
  preferred_gateway?: string;
}

export type PaymentLinkAmountType = "FIXED" | "FREE";

/** Un champ personnalisé collecté sur la page publique du lien (cf. `PaymentLink.custom_fields`). */
export interface PaymentLinkCustomField {
  key: string;
  label: string;
  required?: boolean;
}

export interface PaymentLink {
  id: string;
  merchant?: string;
  created_by_member?: string | null;
  name: string;
  description?: string;
  amount_type?: PaymentLinkAmountType;
  amount?: string | null;
  min_amount?: string | null;
  currency: string;
  slug: string;
  url: string;
  is_active?: boolean;
  admin_locked: boolean;
  expires_at?: string | null;
  usage_limit?: number | null;
  usage_count: number;
  require_phone?: boolean;
  facebook_pixel_id?: string;
  google_ads_id?: string;
  custom_fields?: PaymentLinkCustomField[];
  /** true (défaut) : la page interne affiche sa propre confirmation ; false : redirige vers `redirect_url` (alors obligatoire). */
  show_confirmation_page?: boolean;
  redirect_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentLinkParams {
  name: string;
  description?: string;
  amount_type?: PaymentLinkAmountType;
  amount?: number | string | null;
  min_amount?: number | string | null;
  currency: string;
  expires_at?: string | null;
  usage_limit?: number | null;
  require_phone?: boolean;
  facebook_pixel_id?: string;
  google_ads_id?: string;
  custom_fields?: PaymentLinkCustomField[];
  show_confirmation_page?: boolean;
  redirect_url?: string;
}

/** Réponse de `GET /payment-links/public/{slug}/` — ce que voit la page publique du lien, jamais l'id interne du marchand. */
export interface PublicPaymentLink {
  name: string;
  merchant_name: string;
  description?: string;
  amount_type: PaymentLinkAmountType;
  amount?: string | null;
  min_amount?: string | null;
  currency: string;
  slug: string;
  is_usable: boolean;
  unusable_reason?: string;
  require_phone: boolean;
  facebook_pixel_id?: string;
  google_ads_id?: string;
  custom_fields?: PaymentLinkCustomField[];
}

/** Corps de `POST /payment-links/public/{slug}/checkout/` — pas de pays/réseau : ça se choisit sur la CheckoutSession créée en retour. */
export interface CreatePublicCheckoutParams {
  /** Requis si le lien est à montant libre (`amount_type: "FREE"`) ; ignoré pour un lien à montant fixe. */
  amount?: number | string;
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    /** Requis si `PublicPaymentLink.require_phone` est true. */
    phone?: string;
  };
  /** Valeurs des champs définis par `PublicPaymentLink.custom_fields`, indexées par leur `key`. */
  custom_field_values?: Record<string, string | number | boolean | null>;
}

/** Réponse de `POST /payment-links/public/{slug}/checkout/` — `slug` est celui de la nouvelle CheckoutSession one-shot créée, à passer au SDK checkout public (mobile/web) pour la suite du paiement. */
export interface PublicCheckoutResult {
  slug: string;
  checkout_url: string;
}

export type CheckoutSessionStatus = "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";

export interface CheckoutSession {
  id: string;
  merchant?: string;
  created_by_member?: string | null;
  slug: string;
  checkout_url: string;
  amount: string;
  currency: string;
  description?: string;
  country?: string | null;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
  status: CheckoutSessionStatus;
  expires_at?: string | null;
  transaction: string | null;
  payment_link: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCheckoutSessionParams {
  amount: number | string;
  currency: string;
  description?: string;
  country?: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  return_url?: string;
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  merchant?: string;
  phone?: string | null;
  /** UUID de `geo.Country` (ForeignKey côté API) — PAS un code ISO2 ("BJ"). Référentiel pas encore couvert par ce SDK. */
  country: string;
  full_name?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface UpsertCustomerParams {
  phone?: string;
  /** UUID de `geo.Country` (ForeignKey côté API) — PAS un code ISO2 ("BJ"), contrairement à `country` sur les transactions/paiements. Référentiel pas encore couvert par ce SDK. */
  country: string;
  full_name?: string;
  email?: string;
}

export type SettlementStatus = "PENDING" | "APPROVED" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface Settlement {
  id: string;
  reference: string;
  merchant?: string;
  payout_method: string;
  country: string;
  requested_amount: string;
  fee_charge_mode: FeeChargeMode;
  client_fee: string;
  gateway_fee: string;
  platform_fee: string;
  debited_amount: string;
  net_amount: string;
  currency: string;
  status: SettlementStatus;
  ip_address?: string | null;
  approved_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  gateway_reference: string;
  proof_url: string;
  failure_reason: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSettlementParams {
  country: string;
  requested_amount: number | string;
  payout_method: string;
}

export type WalletTransferStatus = "PENDING" | "APPROVED" | "PROCESSING" | "SUCCESS" | "FAILED" | "REJECTED";

export interface WalletTransfer {
  id: string;
  reference: string;
  merchant?: string;
  from_country: string;
  to_country: string;
  from_amount: string;
  from_currency: string;
  to_amount: string;
  to_currency: string;
  exchange_rate: string;
  status: WalletTransferStatus;
  approved_at: string | null;
  completed_at: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWalletTransferParams {
  from_country: string;
  to_country: string;
  from_amount: number | string;
}

export interface MerchantBalance {
  id: string;
  merchant: string;
  country: string;
  currency: string;
  available_amount: string;
  pending_amount: string;
  frozen_amount: string;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
}

export interface MerchantLedgerEntry {
  id: string;
  country: string;
  currency: string;
  direction: "CREDIT" | "DEBIT";
  amount: string;
  balance_after: string;
  reference?: string;
  created_at: string;
  [key: string]: unknown;
}

export type ApiKeyScope = "PAYIN" | "PAYOUT" | "BOTH";

export interface MerchantApiKey {
  id: string;
  merchant: string;
  name?: string;
  key_prefix: string;
  environment: Environment;
  scope?: ApiKeyScope;
  is_active: boolean;
  expires_at?: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Réponse de création uniquement — `secret` en clair, non récupérable ensuite. */
export interface CreatedMerchantApiKey extends MerchantApiKey {
  secret: string;
}

export interface CreateApiKeyParams {
  name?: string;
  environment: Environment;
  scope?: ApiKeyScope;
  expires_at?: string | null;
}

export interface MerchantWebhook {
  id: string;
  merchant?: string;
  url: string;
  description?: string;
  /** En clair seulement à la création/rotation — jamais renvoyé ensuite. */
  signing_secret?: string;
  environment: Environment;
  is_active?: boolean;
  /** Restreint ce endpoint aux événements d'UN lien de paiement précis — `null`/absent : tous les liens du marchand. */
  payment_link?: string | null;
  created_by_member?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookParams {
  url: string;
  description?: string;
  environment: Environment;
  /** Laisser vide pour qu'AlphaPay génère un secret sécurisé. */
  signing_secret?: string;
  /** Restreint ce endpoint aux événements d'UN lien de paiement précis (son `id`) — omis : tous les liens du marchand. */
  payment_link?: string | null;
}

export type WebhookLogStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXHAUSTED";

export interface WebhookLog {
  id: string;
  webhook: string;
  transaction: string | null;
  settlement: string | null;
  wallet_transfer: string | null;
  event_type: string;
  url: string;
  payload: Record<string, unknown>;
  http_status: number | null;
  attempt: number;
  status: WebhookLogStatus;
  sent_at: string | null;
  response_body: string;
  next_retry_at: string | null;
  exhausted_at: string | null;
  created_at: string;
}

/** Ces libellés reflètent apps.webhooks — vérifier /merchant-webhook-events/ pour la liste à jour. */
export type WebhookEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payout.succeeded"
  | "payout.failed"
  | "settlement.succeeded"
  | "settlement.failed"
  | "wallet_transfer.succeeded"
  | "wallet_transfer.failed"
  | (string & {});

export interface WebhookEvent<T = Record<string, unknown>> {
  event: WebhookEventType;
  data: T;
}
