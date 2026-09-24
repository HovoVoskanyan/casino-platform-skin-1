// Pulls the GATEWAY's aggregated OpenAPI document (identity + core + payments + bonus player routes, P3-26) into
// openapi/gateway.json (committed, so `npm run api:gen` works offline and contract changes show up in diffs).
// Point GATEWAY_URL at a running gateway — the laptop compose stack exposes it on 127.0.0.1:5000. On servers the
// document is docker-network-only, so codegen always runs against the laptop stack, as the BO front's does.
import { writeFile, mkdir } from "node:fs/promises";

const base = process.env.GATEWAY_URL ?? "http://127.0.0.1:5000";
const url = `${base}/openapi/v1.json`;
const res = await fetch(url);
if (!res.ok) {
  console.error(`GET ${url} -> ${res.status} ${res.statusText}`);
  process.exit(1);
}
const doc = await res.json();
await mkdir("openapi", { recursive: true });
await writeFile("openapi/gateway.json", JSON.stringify(doc, null, 2) + "\n");
console.log(`openapi/gateway.json <- ${url} (${Object.keys(doc.paths ?? {}).length} paths)`);
