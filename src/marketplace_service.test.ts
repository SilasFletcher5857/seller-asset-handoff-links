import assert from "node:assert/strict";
import { z } from "zod";
const request = z.object({ sellerId: z.string().min(1), assetKey: z.string().min(1), buyerEmail: z.string().email(), orderId: z.string().min(1) });
const valid = { sellerId: "seller-7", assetKey: "seller-7/manual.pdf", buyerEmail: "buyer@example.com", orderId: "order-42" };
assert.equal(request.parse(valid).orderId, "order-42");
assert.throws(() => request.parse({ ...valid, buyerEmail: "bad" }), z.ZodError);
console.log("handoff boundary: valid orders pass; malformed buyer email is rejected");
