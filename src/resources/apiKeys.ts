import type { Http } from "../http.js";
import type { CreateApiKeyParams, CreatedMerchantApiKey, ListParams, MerchantApiKey, PaginatedList } from "../types.js";

export interface MerchantIpWhitelistEntry {
  id: string;
  merchant?: string;
  ip_address: string;
  label?: string;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface CreateIpWhitelistEntryParams {
  ip_address: string;
  label?: string;
}

/**
 * Gestion des clés API du marchand et de la whitelist IP requise pour les
 * payouts (partagée par toutes les clés du marchand, cf.
 * apps.api_keys.models.MerchantIpWhitelistEntry côté API).
 *
 * ⚠️ **`list`/`create`/`get`/`revoke`/`delete` ci-dessous sont entièrement
 * inaccessibles via clé API** (403, `code: "dashboard_only"`, vérifié en
 * conditions réelles) — cohérent avec la sécurité attendue : une clé
 * compromise ne doit pas pouvoir créer d'autres clés pour elle-même ni lister
 * les clés existantes. Seule `ipWhitelist` (plus bas) fonctionne via clé API.
 */
export class ApiKeysResource {
  constructor(private readonly http: Http) {}

  list(params: ListParams = {}): Promise<PaginatedList<MerchantApiKey>> {
    return this.http.request("GET", "/merchant-api-keys/", { query: params });
  }

  /** `secret` n'est présent QUE dans cette réponse — jamais récupérable ensuite, à stocker immédiatement côté appelant. */
  create(params: CreateApiKeyParams): Promise<CreatedMerchantApiKey> {
    return this.http.request("POST", "/merchant-api-keys/", { body: params });
  }

  get(id: string): Promise<MerchantApiKey> {
    return this.http.request("GET", `/merchant-api-keys/${id}/`);
  }

  revoke(id: string): Promise<MerchantApiKey> {
    return this.http.request("POST", `/merchant-api-keys/${id}/revoke/`);
  }

  delete(id: string): Promise<void> {
    return this.http.request("DELETE", `/merchant-api-keys/${id}/`);
  }

  /** Ces 4 méthodes, contrairement à celles ci-dessus, fonctionnent bien via clé API — vérifié en conditions réelles. */
  ipWhitelist = {
    list: (params: ListParams = {}): Promise<PaginatedList<MerchantIpWhitelistEntry>> =>
      this.http.request("GET", "/merchant-ip-whitelist/", { query: params }),

    create: (params: CreateIpWhitelistEntryParams): Promise<MerchantIpWhitelistEntry> =>
      this.http.request("POST", "/merchant-ip-whitelist/", { body: params }),

    update: (id: string, params: Partial<CreateIpWhitelistEntryParams> & { status?: "ACTIVE" | "INACTIVE" }): Promise<MerchantIpWhitelistEntry> =>
      this.http.request("PATCH", `/merchant-ip-whitelist/${id}/`, { body: params }),

    delete: (id: string): Promise<void> => this.http.request("DELETE", `/merchant-ip-whitelist/${id}/`),
  };
}
