#!/usr/bin/env node
/**
 * Gera ANON_KEY e SERVICE_ROLE_KEY a partir do JWT_SECRET.
 * Uso:  JWT_SECRET="..." node deploy/scripts/gen-jwt.js
 * (ou rode dentro do install.sh).
 */
const crypto = require("crypto");

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error("ERRO: defina JWT_SECRET com no mínimo 32 caracteres.");
  process.exit(1);
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

function sign(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64url(sig)}`;
}

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 anos

const anon = sign({ role: "anon", iss: "supabase", iat, exp });
const service = sign({ role: "service_role", iss: "supabase", iat, exp });

console.log("ANON_KEY=" + anon);
console.log("SERVICE_ROLE_KEY=" + service);
