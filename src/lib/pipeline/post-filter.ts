import { z } from "zod";

const PostFilterSchema = z.object({
  type: z.string(),
  text: z.string(),
});

export const postFilter = (llmResponse: string): string => {
  // 1. Validar que sea string no vacío
  if (typeof llmResponse !== "string" || llmResponse.trim().length === 0) {
    return "Disculpa, tuve un problema. Un asesor te responderá pronto.";
  }

  // 2. Máximo 4096 caracteres (límite de WhatsApp)
  const max = 4096;
  const response = llmResponse.length > max
    ? llmResponse.substring(0, max).trim() + "..."
    : llmResponse.trim();

  // 3. Quitar bloques de código/markdown pesado (WhatsApp solo soporta *negrita* y _cursiva_)
  let cleaned = response
    .replace(/```[\s\S]*?```/g, "") // bloques de código triple
    .replace(/\*\*[^\*]+?\*\*/g, "") // negrita doble (puede quedar algún *, pero es lo mejor que hacemos sin BD)
    .replace(/__[^_]+?__/g, "") // negrita doble con underscore
    .replace(/~~[^~]+?~~/g, ""); // tachado

  // 4. Mantener solo *negrita* y _cursiva_ simples (whatsApp compatible)
  // Quitar asteriscos sueltos que no sean de negrita
  cleaned = cleaned.replace(/\*[^*]+?\*/g, "");

  // 5. Quitar URLs muy largas o no validadas (opcional: podríamos acortarlas)
  // Por ahora, las dejamos si el LLM las generó correctamente

  // 6. Validar con Zod que el tipo y texto sean correctos
  const validation = PostFilterSchema.safeParse({
    type: "text",
    text: cleaned,
  });

  if (!validation.success) {
    return "Disculpa, tuve un problema. Un asesor te responderá pronto.";
  }

  return cleaned;
};