import { Http, type AlphaPayClientOptions } from "./http.js";
import { ApiKeysResource } from "./resources/apiKeys.js";
import { BalancesResource } from "./resources/balances.js";
import { CheckoutSessionsResource } from "./resources/checkoutSessions.js";
import { CustomersResource } from "./resources/customers.js";
import { PaymentLinksResource } from "./resources/paymentLinks.js";
import { SettlementsResource } from "./resources/settlements.js";
import { TransactionsResource } from "./resources/transactions.js";
import { WalletTransfersResource } from "./resources/walletTransfers.js";
import { WebhookEndpointsResource } from "./resources/webhookEndpoints.js";

export type { AlphaPayClientOptions } from "./http.js";

/**
 * Client principal du SDK AlphaPay. Une instance = une clé API = un
 * marchand + un environnement (live/sandbox, déduit automatiquement du
 * préfixe de la clé — `sk_live_...` ou `sk_test_...`).
 *
 * @example
 * const alphapay = new AlphaPayClient({ apiKey: process.env.ALPHAPAY_SECRET_KEY! });
 * const payment = await alphapay.transactions.payin.initialize({
 *   amount: 5000,
 *   currency: "XOF",
 *   country: "BJ",
 *   network: "mtn_bj",
 *   customer: { email: "client@exemple.com", first_name: "Client", last_name: "Test", phone: "+22900000000" },
 * });
 */
export class AlphaPayClient {
  readonly environment: "live" | "sandbox";
  /**
   * Client HTTP bas niveau — nécessaire à `paginate()` pour suivre un lien
   * `next` (URL absolue renvoyée par l'API), pas destiné à un usage direct
   * en dehors de ce cas.
   */
  readonly http: Http;

  readonly transactions: TransactionsResource;
  readonly paymentLinks: PaymentLinksResource;
  readonly checkoutSessions: CheckoutSessionsResource;
  readonly customers: CustomersResource;
  readonly settlements: SettlementsResource;
  readonly walletTransfers: WalletTransfersResource;
  readonly balances: BalancesResource;
  readonly apiKeys: ApiKeysResource;
  readonly webhookEndpoints: WebhookEndpointsResource;

  constructor(options: AlphaPayClientOptions) {
    const http = new Http(options);
    this.http = http;
    this.environment = http.environment;

    this.transactions = new TransactionsResource(http);
    this.paymentLinks = new PaymentLinksResource(http);
    this.checkoutSessions = new CheckoutSessionsResource(http);
    this.customers = new CustomersResource(http);
    this.settlements = new SettlementsResource(http);
    this.walletTransfers = new WalletTransfersResource(http);
    this.balances = new BalancesResource(http);
    this.apiKeys = new ApiKeysResource(http);
    this.webhookEndpoints = new WebhookEndpointsResource(http);
  }
}
