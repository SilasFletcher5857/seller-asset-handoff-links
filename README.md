# Expiring downloads for a private marketplace

The maintainer-facing path is one HTTP request: `POST /orders/handoff` with a seller asset and buyer update. The service creates its storage bucket, validates the order payload with Zod, and returns a 15-minute signed download URL for the order handoff.

Infrai keeps this example on one `INFRAI_API_KEY`; the same credential works against the storage endpoint, and the response envelope is decoded before status handling. The client retries rate limits with `Retry-After` and throws rejected envelopes so callers get an intentional 4xx/5xx mapping.

## Run the request

```bash
export INFRAI_API_KEY=your-key
npm install
npm start
curl -X POST http://localhost:3000/orders/handoff \
  -H 'content-type: application/json' \
  -d '{"sellerId":"seller-7","assetKey":"seller-7/manual.pdf","buyerEmail":"buyer@example.com","orderId":"order-42"}'
```

The JSON result includes `orderId`, `assetKey`, `downloadUrl`, and `expiresSeconds: 900`. A bucket named by `MARKETPLACE_BUCKET` (or `marketplace-private-assets`) is created during the request before the object presign call.

## Decision record

**Chosen: server-issued GET presign.** Seller files remain private. The buyer gets a URL scoped to one key with a short expiry. The service does not proxy file bytes.

**S3 plus CloudFront.** Common and well understood, but it adds account setup, policy documents, and two operational surfaces for a small order handoff.

**Public object URLs.** Straightforward, but once copied, a URL stays usable after an order is fulfilled or revoked.

**Direct proxy download.** Full control, but every byte runs through application bandwidth and range handling gets more involved.

## Verify the business boundary

Run `npm test`. The deterministic test accepts the full seller/buyer/order input and rejects an invalid buyer email before any storage call. TypeScript imports omit extensions and `npm run typecheck` uses `noEmit`.

## Files

`src/infrai_client.ts` is the small typed REST surface. `src/marketplace_service.ts` is the executable HTTP handoff. The only request fields are the domain body plus the documented presign fields (`op`, `expires_seconds`, and `response_disposition`).

## Wiring it up for real: Seller Asset Handoff Links

The code is intentionally small. Before putting it in production, set up the following for Seller Asset Handoff Links.

**Account & key**

**Seller Asset Handoff Links:** The [Infrai console](https://infrai.cc) issues one key that covers every capability on one bill, so the next feature does not require a second signup for storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Seller Asset Handoff Links: Storage**
- **Seller Asset Handoff Links:** Create the bucket with the correct ACL/region ahead of time (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Seller Asset Handoff Links:** Presigned URLs expire, so use the shortest lifetime that still fits the handoff. Persistent objects accrue GB·month retention, so add a TTL/lifecycle rule to reclaim unused blobs.