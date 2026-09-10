# Avant publication npm

Ce SDK est fonctionnel et testé (`npm test`, `npm run build` passent tous les
deux). `transactions.list()` a été vérifié une fois contre une vraie clé
LIVE (lecture seule) — voir "Fait" plus bas pour ce que ça a révélé et
corrigé. Le reste des ressources n'a tourné que contre un `fetch` simulé. À
faire avant `npm publish` :

## Bloquant

- [x] **Vérifier `list()`/`get()` de chaque ressource contre une vraie clé
      LIVE** (lecture seule, aucune écriture) — fait. Résultat : forme des
      réponses conforme au SDK partout, ET découverte que `settlements`,
      `walletTransfers`, `balances.ledgerEntries`, `apiKeys` (sauf
      `ipWhitelist`) sont **entièrement inaccessibles via clé API** (403
      `dashboard_only`, restriction volontaire — cf. `forbid_api_key` côté
      AlphaPayBack) — documenté dans le code et le README, pas un bug à corriger.
- [ ] **Tester les écritures contre une vraie clé sandbox** (`sk_test_...`) —
      pas encore fait (pas de clé sandbox disponible au moment de cette
      vérification, seulement une clé live, testée en lecture seule
      uniquement pour ne rien déclencher de réel) : `transactions.payin.initialize`
      → `payin.verify`, `paymentLinks.create`, `checkoutSessions.create` +
      réception d'un vrai webhook et vérification de sa signature.
- [ ] Vérifier si d'autres méthodes `list()`/`get()` que `transactions.list()`
      utilisent une pagination par curseur plutôt que par page, en particulier
      pour toute ressource ajoutée après cette vérification (`grep
      pagination_class apps/*/views/*.py` côté AlphaPayBack plutôt que
      supposer le défaut) — fait pour les 9 ressources actuelles, à refaire
      pour toute nouvelle ressource.
- [ ] Vérifier le nom exact des codes réseau (`network`) et méthodes de payout
      (`method`) attendus par l'API — ce SDK les documente comme des chaînes
      libres (`"MTN_BJ"` à titre d'exemple), jamais validées côté TypeScript.
      Un futur `alphapay.networks.list()` (endpoint `/networks/` existant côté
      API, pas encore dans ce SDK) permettrait de les typer en enum.
- [ ] Choisir le nom de package npm définitif (`@alphapay/node` est un nom
      provisoire — vérifier qu'il est disponible / que l'org existe sur npm).

## Souhaitable avant v1.0.0

- [ ] Couvrir les ressources listées comme "pas encore couvertes" dans le
      README (équipe, KYC, configs marchand, référentiels pays/réseaux/taux).
- [ ] CI (GitHub Actions) : `typecheck` + `test` + `build` sur chaque PR.
- [ ] Publier le SDK Flutter/mobile correspondant (checkout public uniquement,
      jamais la clé secrète — cf. section sécurité du README) pour que les
      deux SDK avancent ensemble.
- [ ] Remonter côté AlphaPayBack les ~20 vues sans `serializer_class` restées
      sous-typées dans le schéma OpenAPI (callbacks gateway, quelques actions
      KYC/checkout) — annotées `@extend_schema` une par une, cf. warnings de
      `manage.py spectacular` (`apps.core.openapi`). Aucune n'est dans la
      surface actuellement couverte par ce SDK, donc pas bloquant ici, mais
      ça limitera la précision d'un futur SDK PHP/Python généré depuis le
      même schéma.
- [ ] Exemples d'intégration complets (`examples/express-webhook`,
      `examples/payment-link-checkout`) plutôt que les extraits du README.

## Fait

- [x] Client HTTP : auth Bearer, détection sandbox/live, retries avec
      backoff sur 429/5xx/réseau, timeout configurable, Idempotency-Key
      optionnelle.
- [x] Enveloppe `{success, data, code}` déballée automatiquement ; erreurs
      mappées vers des classes typées (`AlphaPayValidationError` avec
      `fieldErrors`, `AlphaPayRateLimitError` avec `retryAfter`, etc.).
- [x] `verifyWebhookSignature` — HMAC-SHA256 identique à
      `apps.webhooks.services.sign_payload`, comparaison en temps constant,
      fenêtre anti-rejeu de 300s.
- [x] `paginate()` — itération automatique `next` sur les listes paginées.
- [x] 9 ressources (voir tableau README), build ESM+CJS+d.ts via tsup,
      11 tests (`node:test`) verts.
- [x] `list()`/`get()` des 9 ressources vérifiés en lecture seule contre une
      vraie clé live — formes de réponse correctes, restrictions
      `dashboard_only` documentées (voir tableau README, colonne "Via clé API").
