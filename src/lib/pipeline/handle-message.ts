import { getLlmProvider } from "../llm";
import { buildSystemPrompt } from "../llm/system-prompt";
import { conversationStore } from "../store";
import { preFilter } from "./pre-filter";
import { postFilter } from "./post-filter";
import { sendWhatsAppText } from "../whatsapp/send";

export async function handleMessage(
  phone: string,
  wamid: string,
  rawText: string
): Promise<{ success: boolean; response?: string; type?: string; shouldRespond?: boolean }> {
  // 1. Marcar como procesado (idempotencia)
  const isNew = await conversationStore.markProcessed(wamid);
  if (!isNew) {
    return { success: true, shouldRespond: false, type: "duplicate" };
  }

  // 2. Pre-filtro: limpiar, rate limit, validar tipo
  const preResult = await preFilter(phone, rawText, conversationStore as any);
  if (!preResult.valid) {
    // Si es status, no responder nada
    if (preResult.type === "status") {
      return { success: true, shouldRespond: false, type: "status-ignored" };
    }
    // Si es rate-limit, responder aviso corto una sola vez
    if (preResult.type === "rate-limit") {
      return {
        success: true,
        response: "¡Hola! Estamos procesando tus mensajes. Por favor, espera un momento.",
        type: "rate-limit",
      };
    }
    // Si es no-text, responder mensaje fijo
    if (preResult.type === "no-text") {
      return {
        success: true,
        response: "Por ahora solo puedo procesar mensajes de texto, pero un asesor humano revisará tu archivo pronto. ¿En qué más puedo ayudarte?",
        type: "no-text",
      };
    }
    return { success: true, shouldRespond: false, type: "filtered" };
  }

  // 3. Cargar historial de conversación
  const history = await conversationStore.getHistory(phone);

  // 4. Armar contexto para LLM
  const system = buildSystemPrompt();

  // 5. Llamar a LLM con timeout y reintento
  const llmProvider = getLlmProvider({
    LLM_PROVIDER: "nvidia",
    LLM_API_KEY: "", // se obtendrá del env en el route
    LLM_BASE_URL: "https://integrate.api.nvidia.com/v1",
    LLM_MODEL: "llama-3.1-70b-instruct",
  });

  const { generate } = llmProvider;

  let llmResponse: string;
  try {
    // Asegurarse de que text existe (garantizado por pre-filter si valid=true)
    const textToSend = preResult.text || rawText;
    llmResponse = await generate({
      system,
      history,
      userMessage: textToSend,
    });
  } catch (error) {
    console.error("[llm] Error:", error);
    llmResponse = "Tengo un pequeño problema de conexión en este momento. Un asesor humano te responderá a la brevedad.";
  }

  // 6. Post-filtro: validar y limpiar respuesta
  const cleanedResponse = postFilter(llmResponse);

  // 7. Guardar respuesta en store
  await conversationStore.addTurn(phone, {
    role: "assistant",
    content: cleanedResponse,
    at: Date.now(),
  });

  // 8. Enviar a WhatsApp
  try {
    await sendWhatsAppText(phone, cleanedResponse);
  } catch (sendError) {
    console.error("[whatsapp] Error enviando:", sendError);
    // Si falla el envío, aún así guardamos el turno
  }

  return {
    success: true,
    response: cleanedResponse,
    type: "text",
    shouldRespond: true,
  };
}