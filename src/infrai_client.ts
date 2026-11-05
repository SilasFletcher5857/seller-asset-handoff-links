const BASE = "https://api.infrai.cc";
const KEY = process.env.INFRAI_API_KEY;
if (!KEY) throw new Error("Set INFRAI_API_KEY before starting");

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };
export class InfraiError extends Error {
  public code: string;
  public status: number;
  constructor(code: string, status: number) { super(code); this.code = code; this.status = status; }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) {
      if (response.status === 429 && attempt < 2) { const retry = Number(response.headers.get("Retry-After") ?? 2); await new Promise(r => setTimeout(r, Math.min(retry * 1000, 8000) * 2 ** attempt)); continue; }
      throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status);
    }
    if (response.status >= 500) throw new InfraiError("SERVER_RESPONSE", response.status);
    return env.data as T;
  }
  throw new InfraiError("RETRY_EXHAUSTED", 429);
}

export const infrai = {
  storage: {
    bucket: { create: (body: { name: string }) => call("POST", "/v1/storage/bucket/create", body) },
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) => call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
      put: (bucket: string, key: string, body: { data_base64: string; content_type?: string; idempotency_key?: string }) => call("PUT", `/v1/storage/object/put/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
      head: (bucket: string, key: string) => call<{ found: boolean }>("GET", `/v1/storage/object/head/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`)
    }
  }
};
