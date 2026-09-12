import assert from "node:assert/strict";
import { test } from "node:test";
import { AlphaPayClient, AlphaPayRateLimitError, AlphaPayValidationError, paginate } from "../src/index.js";

const BASE = "https://api.test/api/v1";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" }, ...init });
}

test("detects sandbox vs live environment from the key prefix", () => {
  const sandbox = new AlphaPayClient({ apiKey: "sk_test_abc", fetch: async () => jsonResponse({}) });
  const live = new AlphaPayClient({ apiKey: "sk_live_abc", fetch: async () => jsonResponse({}) });
  assert.equal(sandbox.environment, "sandbox");
  assert.equal(live.environment, "live");
});

test("unwraps the {success, data, code} envelope and sends the Bearer header", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const client = new AlphaPayClient({
    apiKey: "sk_test_abc",
    baseUrl: BASE,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init! });
      return jsonResponse({ success: true, data: { id: "tx_1", reference: "REF1" }, code: 200 });
    },
  });

  const tx = await client.transactions.get("tx_1");

  assert.deepEqual(tx, { id: "tx_1", reference: "REF1" });
  assert.equal(calls[0]!.url, `${BASE}/transactions/tx_1/`);
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, "Bearer sk_test_abc");
});

test("maps a 400 field-validation error to AlphaPayValidationError", async () => {
  const client = new AlphaPayClient({
    apiKey: "sk_test_abc",
    baseUrl: BASE,
    fetch: async () => jsonResponse({ success: false, error: { amount: ["Ce champ est requis."] }, code: 400 }, { status: 400 }),
  });

  await assert.rejects(
    () => client.settlements.create({ country: "BJ", requested_amount: 100, payout_method: "x" }),
    (err: unknown) => {
      assert.ok(err instanceof AlphaPayValidationError);
      assert.deepEqual(err.fieldErrors, { amount: ["Ce champ est requis."] });
      return true;
    }
  );
});

test("retries a 429 honoring Retry-After, then resolves", async () => {
  let attempts = 0;
  const client = new AlphaPayClient({
    apiKey: "sk_test_abc",
    baseUrl: BASE,
    maxRetries: 2,
    fetch: async () => {
      attempts += 1;
      if (attempts < 2) {
        return jsonResponse({ success: false, error: { detail: "Throttled" }, code: 429 }, { status: 429, headers: { "Retry-After": "0" } });
      }
      return jsonResponse({ success: true, data: { id: "ok" }, code: 200 });
    },
  });

  const result = await client.transactions.get("x");
  assert.equal(attempts, 2);
  assert.deepEqual(result, { id: "ok" });
});

test("gives up after exhausting retries and throws AlphaPayRateLimitError", async () => {
  let attempts = 0;
  const client = new AlphaPayClient({
    apiKey: "sk_test_abc",
    baseUrl: BASE,
    maxRetries: 1,
    fetch: async () => {
      attempts += 1;
      return jsonResponse({ success: false, error: { detail: "Throttled" }, code: 429 }, { status: 429, headers: { "Retry-After": "0" } });
    },
  });

  await assert.rejects(() => client.transactions.get("x"), AlphaPayRateLimitError);
  assert.equal(attempts, 2); // 1 tentative initiale + 1 retry (maxRetries: 1)
});

test("sends a generated Idempotency-Key when requested", async () => {
  let headers: Record<string, string> | undefined;
  const client = new AlphaPayClient({
    apiKey: "sk_test_abc",
    baseUrl: BASE,
    fetch: async (_url, init) => {
      headers = init!.headers as Record<string, string>;
      return jsonResponse({ success: true, data: {}, code: 201 }, { status: 201 });
    },
  });

  await client.transactions.payin.initialize(
    {
      amount: 100,
      currency: "XOF",
      country: "BJ",
      network: "mtn_bj",
      customer: { email: "client@exemple.com", first_name: "Client", last_name: "Test", phone: "+22900000000" },
    },
    { idempotencyKey: true }
  );

  assert.ok(headers?.["Idempotency-Key"]);
});

test("paginate() follows the cursor-based `next` link on transactions.list() (no `count`, `page` has no effect on this endpoint)", async () => {
  const requestedUrls: string[] = [];
  const client = new AlphaPayClient({
    apiKey: "sk_test_abc",
    baseUrl: BASE,
    fetch: async (url) => {
      requestedUrls.push(String(url));
      if (String(url).includes("cursor=page2")) {
        return jsonResponse({ success: true, data: { next: null, previous: `${BASE}/transactions/`, results: [{ id: "tx_2" }] }, code: 200 });
      }
      // Reflète la vraie forme de TransactionListView (CreatedAtCursorPagination) : pas de `count`.
      return jsonResponse({
        success: true,
        data: { next: `${BASE}/transactions/?cursor=page2`, previous: null, results: [{ id: "tx_1" }] },
        code: 200,
      });
    },
  });

  const collected: unknown[] = [];
  for await (const tx of paginate(client.http, client.transactions.list())) collected.push(tx);

  assert.deepEqual(collected, [{ id: "tx_1" }, { id: "tx_2" }]);
  assert.equal(requestedUrls.length, 2);
  assert.equal(requestedUrls[1], `${BASE}/transactions/?cursor=page2`); // l'URL `next` est suivie telle quelle, jamais reconstruite via un numéro de page.
});
