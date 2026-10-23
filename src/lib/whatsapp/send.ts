import { env } from "@/lib/env";

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const response = await fetch(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.META_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Error al enviar mensaje a Meta: ${response.status}`);
  }
}
