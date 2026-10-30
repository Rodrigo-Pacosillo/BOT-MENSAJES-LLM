import { WhatsAppWebhookSchema } from "../whatsapp/schemas";

export const preFilter = async (
  phone: string,
  rawPayload: unknown,
  store: any
): Promise<{ valid: boolean; message?: string; type?: string; text?: string }> => {
  // 1. Parsear con Zod (ignorar statuses)
  const parsed = WhatsAppWebhookSchema.safeParse(rawPayload);

  if (!parsed.success) {
    return { valid: false, message: "Payload inválido" };
  }

  // 2. Filtrar statuses (entregado/leído) - ignorarlos
  const entry = parsed.data.entry[0];
  if (!entry) {
    return { valid: false, message: "Entrada vacía" };
  }

  const changes = entry.changes[0];
  if (!changes) {
    return { valid: false, message: "Cambios vacíos" };
  }

  // Verificar si es un status (entregado/leído) y ignorarlo
  if (changes.value.statuses && changes.value.statuses.length > 0) {
    return { valid: true, message: "status", type: "status" };
  }

  // 3. Obtener mensajes
  const messages = changes.value.messages;
  if (!messages || messages.length === 0) {
    return { valid: false, message: "No hay mensajes" };
  }

  // 4. Obtener el primer mensaje y su texto
  const message = messages[0];
  const text = message.text?.body;

  if (!text) {
    // No es un mensaje de texto (puede ser audio, imagen, etc.)
    return { valid: false, message: "no-text", type: "non-text" };
  }

  // 5. Aplicar limpieza al texto
  const cleanedText = text
    .trim()
    .replace(/\s+/g, ' ') // colapsar múltiples espacios
    .substring(0, 1000); // limitar a ~1000 caracteres

  if (cleanedText.length === 0) {
    return { valid: false, message: "Mensaje vacío después de limpiar" };
  }

  // 5. Rate limit simple (máx. 10 mensajes por minuto por teléfono)
  const count = await store.hit(phone, 60 * 1000);
  if (count > 10) {
    return { valid: false, message: "rate-limit", type: "rate-limit" };
  }

  return {
    valid: true,
    text: cleanedText,
    type: "text",
  };
};