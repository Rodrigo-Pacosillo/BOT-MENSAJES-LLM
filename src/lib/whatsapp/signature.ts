import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

// Meta envía el header x-hub-signature-256 con el formato "sha256=<hash en hex>".
export function isSignatureValid(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const expected =
    "sha256=" + createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
