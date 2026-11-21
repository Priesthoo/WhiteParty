import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "AWNQR1";
const CODE = /^AWN-2026-[A-F0-9]{16}$/;
const NONCE = /^[a-f0-9]{32}$/;

function secret() {
  const value = process.env.TICKET_QR_SECRET;
  if (!value || !/^[a-f0-9]{64}$/.test(value) || Buffer.byteLength(value, "hex") < 32) throw new Error("TICKET_QR_SECRET_NOT_CONFIGURED");
  return value;
}
function signature(code: string, nonce: string) {
  return createHmac("sha256", Buffer.from(secret(), "hex")).update(`${code}.${nonce}`).digest("hex");
}
export function createQrCredential(code: string, nonce: string) {
  if (!CODE.test(code) || !NONCE.test(nonce)) throw new Error("INVALID_TICKET_CREDENTIAL");
  return [VERSION, code, nonce, signature(code, nonce)].join(".");
}
export function verifyQrCredential(value: string) {
  if (value.length > 256) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [version, code, nonce, supplied] = parts;
  if (version !== VERSION || !CODE.test(code) || !NONCE.test(nonce) || !/^[a-f0-9]{64}$/.test(supplied)) return null;
  const a = Buffer.from(supplied, "hex");
  const b = Buffer.from(signature(code, nonce), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { ticketCode: code, nonce };
}
