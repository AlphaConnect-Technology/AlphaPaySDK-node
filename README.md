# @alphapay/node

SDK Node.js / TypeScript officiel pour l'API AlphaPay (agrégateur de paiement multi-gateway).

> **Statut : v0.1.0, non publié.** Couvre les ressources marchand principales
> (paiements, retraits, liens de paiement, checkout, reversements, wallets,
> webhooks, clients, clés API). Généré et vérifié contre le schéma OpenAPI
> réel d'AlphaPayBack (`drf-spectacular`) — voir [CHECKLIST.md](./CHECKLIST.md)
> pour ce qui manque encore avant une publication npm.

Fonctionne aussi tel quel dans **React Native** (même runtime JS, pas de
dépendance Node-only comme `fs`) — à l'exception de `verifyWebhookSignature`
et `apiKeys.rotateSecret`/`webhookEndpoints.rotateSecret`, qui utilisent
`node:crypto` et n'ont de sens que côté serveur de toute façon (jamais de clé
secrète dans une app mobile — voir la note de sécurité plus bas).

## Installation

```bash
npm install @alphapay/node
```

## Démarrage rapide

```ts
import { AlphaPayClient } from "@alphapay/node";

const alphapay = new AlphaPayClient({
  apiKey: process.env.ALPHAPAY_SECRET_KEY!, // sk_live_... ou sk_test_...
});

// Encaissement direct (push mobile money), sans page de checkout à suivre.
const payment = await alphapay.transactions.payin.initialize(
  {
    amount: 5000,
    currency: "XOF",
    country: "BJ",
    network: "MTN_BJ", // cf. alphapay.networks — à venir dans une version future
    customer: { full_name: "Ayaba Client", phone: "+22900000000" },
    description: "Commande #1234",
  },
  { idempotencyKey: true } // recommandé : évite un double push en cas de retry réseau
);

console.log(payment.status, payment.instructions);
```

## Sandbox vs live

L'environnement se déduit automatiquement du préfixe de la clé — aucune
option séparée :

```ts
new AlphaPayClient({ apiKey: "sk_test_..." }); // client.environment === "sandbox"
new AlphaPayClient({ apiKey: "sk_live_..." }); // client.environment === "live"
```

## Gestion des erreurs

Toute erreur API est normalisée en une sous-classe de `AlphaPayError` — jamais
un code HTTP brut à interpréter soi-même :

```ts
import { AlphaPayClient, AlphaPayValidationError, AlphaPayRateLimitError } from "@alphapay/node";

try {
  await alphapay.settlements.create({ country: "BJ", requested_amount: 100, payout_method: methodId });
} catch (err) {
  if (err instanceof AlphaPayValidationError) {
    console.error(err.fieldErrors); // {"requested_amount": ["Montant minimum : 500 XOF."]}
  } else if (err instanceof AlphaPayRateLimitError) {
    console.error(`Réessayer dans ${err.retryAfter}s`);
  } else {
    throw err;
  }
}
```

`AlphaPayAuthenticationError`, `AlphaPayPermissionError`, `AlphaPayNotFoundError`,
`AlphaPayIdempotencyError` (409 — clé Idempotency-Key réutilisée avec un
payload différent), `AlphaPayServerError` et `AlphaPayConnectionError`
(réseau/timeout, jamais atteint l'API) couvrent le reste. Le client retente
automatiquement (backoff exponentiel + gigue) sur 429/5xx/erreur réseau —
2 tentatives supplémentaires par défaut, configurable via `maxRetries`.

## Pagination

`paginate()` suit le lien `next` renvoyé par l'API (pas un numéro de page
recalculé côté SDK) — fonctionne aussi bien sur les ressources paginées par
page (`count` présent) que sur `transactions.list()`, paginée par curseur
(`TransactionListView` utilise `CreatedAtCursorPagination` côté API, sans
`count` ; y passer un `page` n'aurait aucun effet) :

```ts
import { paginate } from "@alphapay/node";

for await (const tx of paginate(alphapay.http, alphapay.transactions.list({ status: "SUCCESS" }))) {
  console.log(tx.reference, tx.amounts.net);
}
```

## Vérifier un webhook reçu

Reproduit exactement le schéma de signature d'AlphaPayBack (HMAC-SHA256 de
`"<timestamp>.<corps>"`, comparaison en temps constant, fenêtre anti-rejeu de
300s) :

```ts
import { verifyWebhookSignature, AlphaPayWebhookSignatureError } from "@alphapay/node";
import express from "express";

const app = express();
app.post("/webhooks/alphapay", express.text({ type: "*/*" }), (req, res) => {
  try {
    const event = verifyWebhookSignature({
      payload: req.body, // corps BRUT, jamais déjà parsé en JSON
      signature: req.header("X-Webhook-Signature")!,
      timestamp: req.header("X-Webhook-Timestamp")!,
      secret: process.env.ALPHAPAY_WEBHOOK_SECRET!,
    });
    console.log(event.event, event.data);
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof AlphaPayWebhookSignatureError) return res.sendStatus(400);
    throw err;
  }
});
```

## ⚠️ Sécurité — ce SDK est côté serveur uniquement

La clé API (`sk_live_.../sk_test_...`) donne un accès complet au compte
marchand (créer des paiements, déclencher des retraits, lire l'historique).
**Ne l'embarquez jamais dans une app mobile ou un site statique** — n'importe
qui peut l'extraire d'un bundle Flutter/React Native ou du JS servi au
navigateur.

Pour un paiement initié par le client final depuis une app mobile : créez la
session de checkout **depuis votre serveur** avec ce SDK
(`alphapay.checkoutSessions.create(...)`), puis pilotez le paiement depuis
l'app avec le SDK Flutter/mobile AlphaPay (à venir) en utilisant uniquement
le `slug` de la session — jamais la clé secrète.

## Ressources couvertes

| Ressource | Méthodes | Via clé API |
|---|---|---|
| `transactions` | `list`, `get`, `export`, `downloadInvoice`, `payin.{initialize,verify,retry,confirmOtp}`, `payout.{initialize,verify}` | ✅ |
| `paymentLinks` | `list`, `create`, `get`, `update`, `delete` | ✅ |
| `checkoutSessions` | `list`, `create`, `get`, `cancel` | ✅ |
| `customers` | `list`, `create`, `get`, `update`, `delete`, `transactions` | ✅ |
| `settlements` | `list`, `create`, `get`, `cancel` | ❌ dashboard-only |
| `walletTransfers` | `list`, `create`, `get` | ❌ dashboard-only |
| `balances` | `list`, `get` | ✅ |
| `balances` | `ledgerEntries` | ❌ dashboard-only |
| `apiKeys` | `list`, `create`, `get`, `revoke`, `delete` | ❌ dashboard-only |
| `apiKeys` | `ipWhitelist.{list,create,update,delete}` | ✅ |
| `webhookEndpoints` | `list`, `get`, `subscriptions.list`, `logs.{list,get}` | ✅ |
| `webhookEndpoints` | `create`, `update`, `rotateSecret`, `delete`, `subscriptions.{subscribe,unsubscribe}`, `logs.resend` | ❌ dashboard-only |

### La colonne "Via clé API"

Vérifié en conditions réelles (`api.alphapay.me`, appels en lecture) : une
partie de l'API est **volontairement inaccessible à une clé API**, même en
lecture — jamais un bug, toujours `apps.core.mixins.forbid_api_key` côté
AlphaPayBack. L'erreur renvoyée est explicite :

```ts
try {
  await alphapay.settlements.list();
} catch (err) {
  if (err instanceof AlphaPayPermissionError && err.code === "dashboard_only") {
    // "La demande de retrait n'est possible que depuis le dashboard (compte utilisateur) — jamais via une clé API."
  }
}
```

Logique : les retraits, l'historique détaillé du grand livre et la gestion
des clés API elles-mêmes exigent qu'un humain soit connecté au dashboard —
une clé compromise ne peut ni sortir d'argent, ni fabriquer d'autres clés
pour elle-même, ni consulter le détail comptable. Ce SDK reste un **client
serveur pour l'encaissement/l'intégration**, pas un remplacement complet du
dashboard.

Pas encore couvert (endpoints existants côté API, absents du SDK pour l'instant) :
gestion d'équipe (`merchant-members`, `merchant-invitations`), KYC marchand,
`merchant-configs`, `audit-logs`, `countries`/`networks`/`exchange-rates`
(référentiels), support (`support-threads`).

## Développement

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # node:test — mock fetch, aucun appel réseau réel
npm run build        # tsup → dist/ (ESM + CJS + .d.ts)
```

## Licence

MIT
