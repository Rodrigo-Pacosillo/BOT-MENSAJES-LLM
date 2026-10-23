# MEJORAS.md — Correcciones y mejoras pendientes del bot de WhatsApp

Instrucciones para el agente. Lee también `AGENTS.md`. Haz **una tarea a la vez**, en orden, y al terminar cada una:
1. Ejecuta `pnpm lint`, `pnpm tsc --noEmit` y `pnpm build`.
2. Dime qué archivos cambiaste y cómo probarlo.
3. Espera mi OK antes de pasar a la siguiente.

No muestres ni imprimas valores de `.env.local` ni de las variables de entorno. No instales dependencias nuevas sin preguntarme.

---

## Tarea 1 (URGENTE): corregir la verificación del webhook

**Archivo:** `src/app/api/webhook/route.ts`, función `GET`.

**Problema:** lee los parámetros con guion bajo (`hub_mode`, `hub_verify_token`, `hub_challenge`), pero Meta los envía con punto (`hub.mode`, `hub.verify_token`, `hub.challenge`). Por eso siempre devuelve `403 Forbidden`.

**Corrección:**
```ts
const mode = req.nextUrl.searchParams.get("hub.mode");
const token = req.nextUrl.searchParams.get("hub.verify_token");
const challenge = req.nextUrl.searchParams.get("hub.challenge");
```

**Criterio de aceptación:**
```
curl "http://localhost:3000/api/webhook?hub.mode=subscribe&hub.verify_token=<META_VERIFY_TOKEN>&hub.challenge=123"
```
debe devolver `123` con status `200`. Con un token incorrecto debe devolver `403`.

Después de esta tarea: commit y push a `main` para que Vercel redespliegue.

---

## Tarea 2: ignorar mensajes que no sean de texto

**Archivo:** `src/lib/whatsapp/schemas.ts` y `route.ts`.

**Problema:** `WhatsAppMessageSchema` exige `text` en todos los mensajes. Si el cliente envía imagen, audio, sticker, etc., el parseo falla, el webhook devuelve `400` y Meta reintenta varias veces.

**Corrección:**
- Agregar `type: z.string()` al esquema del mensaje y hacer `text` opcional.
- En `POST`, si el mensaje no es `type === "text"` o no tiene `text.body`, enviar una respuesta fija ("Por ahora solo puedo leer mensajes de texto 🙂") y devolver `200`.
- Los payloads que solo traen `statuses` (entregado/leído) deben devolver `200` sin hacer nada.
- Un payload inválido pero con firma válida no debe provocar reintentos infinitos: registrar el error y devolver `200`.

**Criterio de aceptación:** enviar una imagen o un audio no genera error `400` en los logs de Vercel y el cliente recibe el mensaje fijo.

---

## Tarea 3: responder `200` rápido y procesar en segundo plano

**Archivo:** `src/app/api/webhook/route.ts`, función `POST`.

**Problema:** el código espera al LLM antes de devolver `200`. Si el LLM tarda, Meta puede reintentar y el bot respondería dos veces.

**Corrección:**
- Validar firma y payload, y devolver `200` de inmediato.
- Procesar el mensaje (LLM + envío) con `after()` de `next/server` (o `waitUntil` de `@vercel/functions` si `after` no está disponible en la versión instalada; pregúntame antes de instalar algo).
- Exportar `export const maxDuration = 60;` en la ruta para que el procesamiento no se corte en Vercel.

**Criterio de aceptación:** el log muestra la respuesta `200` antes de que termine la llamada al LLM, y el cliente recibe una sola respuesta.

---

## Tarea 4: evitar respuestas duplicadas (idempotencia)

**Archivos nuevos:** `src/lib/store/types.ts`, `src/lib/store/memory-store.ts`, `src/lib/store/index.ts` (ver sección 6 de `AGENTS.md`).

**Corrección:**
- Implementar la interfaz `ConversationStore` con `markProcessed(messageId)`.
- En `POST`, antes de procesar, llamar `markProcessed(message.id)`; si ya existía, ignorar el mensaje y devolver `200`.
- TTL de ~1 hora para los IDs guardados.

**Nota:** en Vercel la memoria en RAM es solo "mejor esfuerzo" (cada ejecución puede ser otra instancia). Dejarlo documentado en el README. Más adelante se puede cambiar por Upstash Redis sin tocar el resto del código.

---

## Tarea 5: memoria de conversación

**Archivo:** `src/lib/store/memory-store.ts` y `route.ts`.

**Problema:** el código llama al LLM con `history: []`, así que el bot no recuerda nada de la conversación.

**Corrección:**
- Guardar los últimos 10 turnos por teléfono con `addTurn`.
- Leer `getHistory(phone)` y pasarlo como `history` al LLM.
- Expirar conversaciones inactivas tras ~2 horas.
- Guardar siempre el turno del usuario y la respuesta del asistente.

**Criterio de aceptación:** al preguntar "¿cuánto cuesta?" tras hablar de un producto, el bot entiende a qué producto se refiere.

---

## Tarea 6: pre-filtro, post-filtro y rate limit

**Archivos nuevos:** `src/lib/pipeline/pre-filter.ts`, `src/lib/pipeline/post-filter.ts`, `src/lib/pipeline/handle-message.ts`.

**Corrección:**
- **Pre-filtro:** `trim`, colapsar espacios, limitar a ~1000 caracteres, ignorar mensajes vacíos, rate limit por teléfono (máx. 10 mensajes por minuto).
- **Post-filtro:** validar con Zod que la respuesta sea un `string` no vacío, máximo 4096 caracteres, quitar markdown pesado (`#`, `**`, bloques de código; WhatsApp solo usa `*negrita*` y `_cursiva_`).
- Mover la lógica de `route.ts` a `handle-message.ts` para que la ruta quede delgada.
- Si el LLM falla o devuelve algo inválido, enviar el mensaje de respaldo ya existente.

---

## Tarea 7: revisar el proveedor de LLM (z.ai / GLM)

**Archivos:** `src/lib/llm/openai.ts`, `src/lib/llm/index.ts`.

**Revisar:**
- Que el nombre del modelo funcione (`glm-4.5` en minúsculas vs `GLM-4.5`) según la documentación de z.ai.
- GLM-4.5 puede usar "thinking" (razonamiento) por defecto y consumir `max_tokens` antes de dar contenido, dejando la respuesta vacía. Si pasa, desactivar el razonamiento con el parámetro que indique la documentación de z.ai, o subir `max_tokens`.
- Registrar en logs (sin datos sensibles) el status y un resumen corto cuando el LLM falle.

**Criterio de aceptación:** enviar "Hola, ¿qué venden?" desde WhatsApp devuelve una respuesta de *Cupido* con el tono del system prompt.

---

## Tarea 8: limpieza y robustez

- Cambiar `META_GRAPH_VERSION` a la versión vigente de la app (mi panel de Meta muestra `v26.0`), tanto en `.env.example` como en el valor por defecto de `env.ts`.
- Mejorar el error de `send.ts`: incluir el cuerpo de la respuesta de Meta en el log (sin imprimir el token) para poder diagnosticar errores `401` por token vencido.
- Eliminar `env.txt` de la raíz del repositorio (es una plantilla sin uso; la fuente de verdad es `.env.example`).
- Actualizar `.env.example` para incluir `LLM_BASE_URL`.
- Crear un `README.md` corto con: variables de entorno, cómo correr en local, cómo conectar el webhook en Meta y las limitaciones conocidas (memoria en RAM, token temporal de 24 h).
- Enmascarar el número de teléfono en los logs (ej. `5917****1234`).

---

## Cosas que NO debes hacer
- No agregar base de datos ni Prisma (ver `AGENTS.md`).
- No imprimir secretos en logs ni en tus respuestas.
- No cambiar el stack ni instalar paquetes sin preguntar.
- No subir `.env.local` al repositorio.

---

## Recordatorio para mí (no es para el agente)
- Tras cada cambio en Vercel: esperar a que el despliegue diga **Ready** antes de probar.
- Si cambio variables de entorno en Vercel: **Redeploy**.
- El token de acceso de Meta de prueba dura ~24 h: si el bot recibe mensajes pero no responde y los logs muestran `401` de Meta, generar uno nuevo y actualizarlo en Vercel.
- Regenerar las claves que se pegaron en chats (token de Meta, API key del LLM, clave secreta de Meta).
