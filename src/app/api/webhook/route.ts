import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isSignatureValid } from "@/lib/whatsapp/signature";
import { WhatsAppWebhookSchema } from "@/lib/whatsapp/schemas";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { handleMessage } from "@/lib/pipeline/handle-message";
import { logWebhook } from "@/lib/utils/log";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-hub-signature-256");
  const rawBody = await req.text();

  // PASO 1 — Validar firma HMAC SHA-256 sobre el body raw
  if (!isSignatureValid(rawBody, signature)) {
    logWebhook("Firma invalida");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // Leer y parsear el body
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    logWebhook("JSON invalido");
    return new NextResponse(null, { status: 200 });
  }

  // PASO 2 — Validar payload con Zod
  const parsed = WhatsAppWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    logWebhook("Payload invalido", parsed.error.flatten().fieldErrors);
    return new NextResponse(null, { status: 200 });
  }

  const entry = parsed.data.entry[0];
  if (!entry) {
    return new NextResponse(null, { status: 200 });
  }

  const changes = entry.changes[0];
  if (!changes) {
    return new NextResponse(null, { status: 200 });
  }

  const value = changes.value;

  // Statuses (entregado/leído): ignorar con 200
  if (value.statuses && value.statuses.length > 0) {
    return new NextResponse(null, { status: 200 });
  }

  const messages = value.messages;
  if (!messages || messages.length === 0) {
    return new NextResponse(null, { status: 200 });
  }

  const message = messages[0];
  const phone = message.from;
  const wamid = message.id;
  const text = message.text?.body;

  // PASO 4 — Filtrar tipo de mensaje: solo texto
  if (!text) {
    const cuerpo =
      "Por ahora solo puedo procesar mensajes de texto. ¿Puedes contarme por escrito en qué te puedo ayudar?";
    try {
      await sendWhatsAppText(phone, cuerpo);
    } catch {
      // El envío falló, pero seguimos con 200 para que Meta no reintente
    }
    logWebhook("Mensaje no-texto ignorado", { telefono: phone });
    return new NextResponse(null, { status: 200 });
  }

  // Texto válido: pasar al pipeline (idempotencia y BD se conectan en TAREA 2-4)
  try {
    await handleMessage(phone, wamid, text);
    logWebhook("Mensaje procesado", { telefono: phone });
  } catch (error) {
    logWebhook("Error en pipeline", { telefono: phone, error: String(error) });
  }

  // SIEMPRE responder 200 a Meta cuando el payload es válido
  return new NextResponse(null, { status: 200 });
}
