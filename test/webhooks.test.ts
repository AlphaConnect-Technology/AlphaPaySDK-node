import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { AlphaPayWebhookSignatureError, verifyWebhookSignature } from "../src/index.js";

const SECRET = "whsec_test";

function sign(body: string, timestamp: number): string {
  return createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");
}

test("accepts a correctly signed, fresh payload and returns the parsed event", () => {
  const body = JSON.stringify({ event: "payment.succeeded", data: { id: "tx_123" } });
  const timestamp = Math.floor(Date.now() / 1000);

  const event = verifyWebhookSignature({ payload: body, signature: sign(body, timestamp), timestamp, secret: SECRET });

  assert.deepEqual(event, { event: "payment.succeeded", data: { id: "tx_123" } });
});

test("rejects a payload signed with the wrong secret", () => {
  const body = JSON.stringify({ event: "payment.succeeded", data: {} });
  const timestamp = Math.floor(Date.now() / 1000);
  const wrongSignature = createHmac("sha256", "wrong_secret").update(`${timestamp}.${body}`).digest("hex");

  assert.throws(
    () => verifyWebhookSignature({ payload: body, signature: wrongSignature, timestamp, secret: SECRET }),
    AlphaPayWebhookSignatureError
  );
});

test("rejects a replayed payload whose timestamp is outside the tolerance window", () => {
  const body = JSON.stringify({ event: "payment.succeeded", data: {} });
  const staleTimestamp = Math.floor(Date.now() / 1000) - 10_000;

  assert.throws(
    () => verifyWebhookSignature({ payload: body, signature: sign(body, staleTimestamp), timestamp: staleTimestamp, secret: SECRET }),
    (err: unknown) => err instanceof AlphaPayWebhookSignatureError && /tolérance/.test(err.message)
  );
});

test("rejects a tampered body even if the signature was valid for the original body", () => {
  const originalBody = JSON.stringify({ event: "payment.succeeded", data: { amount: "100" } });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign(originalBody, timestamp);
  const tamperedBody = JSON.stringify({ event: "payment.succeeded", data: { amount: "999999" } });

  assert.throws(
    () => verifyWebhookSignature({ payload: tamperedBody, signature, timestamp, secret: SECRET }),
    AlphaPayWebhookSignatureError
  );
});
