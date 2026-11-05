import { createServer } from "node:http";
import { z } from "zod";
import { infrai } from "./infrai_client.js";

const BUCKET = process.env.MARKETPLACE_BUCKET ?? "marketplace-private-assets";
const assetBody = z.object({ sellerId: z.string().min(1), assetKey: z.string().min(1), buyerEmail: z.string().email(), orderId: z.string().min(1) });
export type Handoff = { orderId: string; assetKey: string; downloadUrl: string; expiresSeconds: number };

export async function prepareHandoff(input: z.infer<typeof assetBody>): Promise<Handoff> {
  const parsed = assetBody.parse(input);
  await infrai.storage.bucket.create({ name: BUCKET });
  const signed = await infrai.storage.object.presign(BUCKET, parsed.assetKey, { op: "get", expires_seconds: 900, response_disposition: `attachment; filename="${parsed.assetKey.split("/").pop()}"` });
  return { orderId: parsed.orderId, assetKey: parsed.assetKey, downloadUrl: signed.url, expiresSeconds: 900 };
}

if (process.argv[1]?.endsWith("marketplace_service.ts")) {
  createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/orders/handoff") { res.writeHead(404).end(); return; }
    try {
      const raw = await new Promise<string>((resolve, reject) => { let data = ""; req.on("data", c => data += c); req.on("end", () => resolve(data)); req.on("error", reject); });
      const result = await prepareHandoff(JSON.parse(raw));
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
    } catch (error) { const status = error instanceof z.ZodError ? 400 : 502; res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request rejected" })); }
  }).listen(Number(process.env.PORT ?? 3000));
}
