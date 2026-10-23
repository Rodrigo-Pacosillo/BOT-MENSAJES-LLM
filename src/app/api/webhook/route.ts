import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isSignatureValid } from "@/lib/whatsapp/signature";
import { WhatsAppWebhookSchema } from "@/lib/whatsapp/schemas";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { buildSystemPrompt } from "@/lib/llm/system-prompt-sexshop";
import { getLlmProvider } from "@/lib/llm";

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

  if (!isSignatureValid(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const parsed = WhatsAppWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    console.error("[webhook] Payload invalido:", parsed.error.flatten().fieldErrors);
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const message = parsed.data.entry[0]?.changes[0]?.value?.messages?.[0];

  if (message) {
    console.log("[webhook] Mensaje recibido", { from: message.from, waId: message.id });
    try {
      const system = buildSystemPrompt();
      const llm = getLlmProvider(env);
      const response = await llm.generate({
        system,
        history: [],
        userMessage: message.text.body,
      });
      await sendWhatsAppText(message.from, response);
    } catch (error) {
      console.error("[llm] Error generando respuesta:", error);
      try {
        await sendWhatsAppText(message.from, "Disculpa, tuve un problema. Un asesor te responderá pronto.");
      } catch (sendError) {
        console.error("[whatsapp] Error al enviar mensaje de respaldo:", sendError);
      }
    }
  }

  return new NextResponse(null, { status: 200 });
}
