# GUIA_FASE_1.md — Bot WhatsApp independiente con memoria persistente

## 1. Objetivo

Construir un bot de WhatsApp que funcione solo, con su propia base de datos.
Debe lograr exactamente estas 5 cosas:

1. Dejar de fallar en el webhook y ante mensajes que no sean texto.
2. Tener su propia base de datos en Neon (PostgreSQL) con Prisma.
3. Recordar las conversaciones anteriores del usuario.
4. Saber si un número es nuevo o ya escribió antes, y conocer su nombre.
5. No responder dos veces el mismo mensaje, aunque Meta lo reenvíe.

No hay integraciones externas. El bot no consulta, escribe ni sincroniza
con ninguna otra aplicación. Su única fuente de datos es su propia BD.

No hay RAG, ni vectores, ni embeddings, ni análisis de imágenes.
Solo mensajes de texto y búsqueda simple de historial.

## 2. Stack obligatorio (no cambiar)

- Next.js 14 App Router + TypeScript en modo strict.
- Zod para validar entradas y variables de entorno.
- PostgreSQL en Neon + Prisma ORM.
- LLM mediante API NVIDIA (compatibilidad OpenAI), configurable por env.
- Gestor de paquetes: pnpm.
- Todo acceso a secretos pasa por src/lib/env.ts. Nunca leer process.env
  directamente en el resto del código.

## 3. Reglas inquebrantables

- Un solo agente CLI trabaja en UNA tarea a la vez.
- Al terminar cada tarea: pnpm lint + pnpm build + prueba manual.
- Esperar el OK del usuario antes de pasar a la siguiente tarea.
- Nunca loguear tokens, API keys ni números completos.
- El webhook SIEMPRE responde 200 a Meta cuando el payload es válido,
  incluso si el LLM falla. Los errores se registran, no se devuelven
  como 500 (evita reintentos infinitos).
- La memoria se lee de la BD. No se usa memoria en RAM como fuente de verdad.

## 4. Variables de entorno (.env.example)

META_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=
META_VERIFY_TOKEN=
META_APP_SECRET=
META_GRAPH_VERSION=v26.0
DATABASE_URL=
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_API_KEY=
LLM_MODEL=
APP_URL=

Validar todas con Zod en src/lib/env.ts. Si falta una, la app falla al iniciar
con un mensaje que indique cuál falta, sin imprimir el valor.

## 5. Modelo de datos (prisma/schema.prisma)

Tres tablas. No agregar más sin autorización.

- Contacto: quién escribe y en qué punto está.
- Mensaje: el historial real de la conversación.
- MensajeProcesado: control de idempotencia por message_id de Meta.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EstadoContacto {
  nuevo
  prospecto
  cliente
}

model Contacto {
  telefono           String         @id
  nombre             String?
  estado             EstadoContacto @default(nuevo)
  ultima_interaccion DateTime       @default(now())
  creado_en          DateTime       @default(now())
  mensajes           Mensaje[]

  @@map("contactos")
}

model Mensaje {
  id          String   @id @default(cuid())
  telefono    String
  rol         String
  contenido   String
  creado_en   DateTime @default(now())
  contacto    Contacto @relation(fields: [telefono], references: [telefono], onDelete: Cascade)

  @@index([telefono, creado_en])
  @@map("mensajes")
}

model MensajeProcesado {
  meta_message_id String   @id
  telefono        String
  resultado       String   @default("procesado")
  creado_en       DateTime @default(now())

  @@map("mensajes_procesados")
}

Notas:
- telefono se guarda siempre en formato internacional sin "+" (ej: 59170000000).
- rol es "user" o "assistant".
- resultado es "procesado", "ignorado" o "fallido".
- El cliente solo se marca "cliente" cuando él mismo lo dice. No se valida
  contra ningún sistema externo.

Crear src/lib/db.ts con singleton de PrismaClient para evitar múltiples
conexiones en desarrollo.

## 6. Flujo de un mensaje (implementar en este orden)

Cuando llega un POST al webhook:

PASO 1 — Validar firma
- Verificar X-Hub-Signature-256 usando META_APP_SECRET sobre el body raw.
- Si la firma no es válida: responder 401 y no procesar nada.

PASO 2 — Validar payload
- Parsear con Zod.
- Si solo vienen statuses (sent/delivered/read): responder 200 y salir.
- Si el payload no es válido pero la firma sí: loguear y responder 200.

PASO 3 — Reservar el message_id (CLAVE de la idempotencia)
- Intentar crear MensajeProcesado con meta_message_id como PK.
- Si ya existe (violación de unicidad): responder 200 y NO procesar.
- Esto se hace ANTES de llamar al LLM, no después, para cubrir también
  dos webhooks simultáneos del mismo mensaje.

PASO 4 — Filtrar tipo de mensaje
- Si type no es "text", o no hay text.body:
  - Enviar: "Por ahora solo puedo procesar mensajes de texto.
    ¿Puedes contarme por escrito en qué te puedo ayudar?"
  - Marcar MensajeProcesado como "ignorado".
  - No guardar en Mensaje. No llamar al LLM.

PASO 5 — Obtener o crear el Contacto
- Buscar por telefono.
- Si no existe: crear con estado "nuevo" y nombre nulo.
- Si existe: el usuario NO es nuevo. Reutilizar su nombre y estado.
- Actualizar ultima_interaccion.

PASO 6 — Guardar el mensaje del usuario
- Insertar en Mensaje con rol "user".

PASO 7 — Resolver el estado conversacional
- Si estado es "nuevo":
  - Responder fijo, sin LLM:
    "¡Hola! Soy el asistente virtual de CONSTR-ART.
    ¿Cómo te llamas?"
  - Guardar esa respuesta en Mensaje con rol "assistant".
  - No llamar al LLM todavía.
- Si estado es "nuevo" y el mensaje anterior del bot pedía el nombre:
  - Tomar el texto como nombre (limitar a 80 caracteres).
  - Guardar Contacto.nombre y cambiar estado a "prospecto".
  - Responder fijo:
    "Mucho gusto, {nombre}. ¿En qué te puedo ayudar hoy?"
  - Guardar respuesta en Mensaje.
- Si el texto coincide con "soy cliente", "ya soy cliente",
  "tengo una obra":
  - Cambiar estado a "cliente".
  - Responder:
    "Perfecto, {nombre}. Tomo nota de que ya eres cliente.
    ¿Con qué necesitas ayuda?"
- En cualquier otro caso con estado "prospecto" o "cliente": pasar al PASO 8.

PASO 8 — Armar contexto desde la BD
- Leer los últimos 10 mensajes de ese telefono ordenados por creado_en DESC,
  luego invertir el orden.
- Construir el contexto con: nombre, estado, último resumen textual
  (los mismos mensajes, sin compresión en esta fase) y pregunta actual.
- NO enviar todo el historial completo, solo los últimos 10.

PASO 9 — Llamar al LLM
- Usar LLM_BASE_URL, LLM_API_KEY y LLM_MODEL.
- System Prompt en español neutro:

  "Eres el asistente virtual de CONSTR-ART, una empresa de construcción.
   Respondes en español neutro, de forma breve, clara y profesional,
   en un máximo de 4 oraciones. No usas Markdown ni listas largas.
   Conoces los datos del contacto que se te proporcionan.
   Nunca inventas precios, plazos, disponibilidad ni datos de terceros.
   Nunca das instrucciones de demolición, cálculos estructurales ni
   consejos que pongan en riesgo la integridad física; en esos casos
   indicas que se requiere evaluación de un profesional.
   No solicitas contraseñas, códigos ni documentos de identidad.
   Si no tienes la información, lo dices y ofreces que un asesor lo revise.
   No afirmas haber creado cotizaciones, reservas ni registros externos."

- Añadir contexto: nombre, estado, historial y pregunta del usuario.
- Timeout máximo: 20 segundos.

PASO 10 — Enviar y guardar
- Si la respuesta del LLM está vacía o la llamada falló:
  "Ahora mismo tengo un problema de conexión. Tu consulta quedó registrada
  y un asesor podrá revisarla. ¿Hay algo más en lo que pueda ayudarte?"
- Enviar la respuesta al numero con la API de Meta.
- Guardar la respuesta enviada en Mensaje con rol "assistant".
- Marcar MensajeProcesado como "procesado" o "fallido".
- Responder 200 a Meta.

## 7. Endpoints y módulos esperados

- GET  /api/webhook           → verificación de Meta.
- POST /api/webhook           → recepción y orquestación.
- src/lib/env.ts              → validación de variables.
- src/lib/db.ts               → singleton Prisma.
- src/lib/whatsapp/schemas.ts → Zod del payload de Meta.
- src/lib/whatsapp/signature.ts → verificación HMAC.
- src/lib/whatsapp/send.ts    → envío de mensajes.
- src/lib/contacts/store.ts   → crear/buscar/actualizar Contacto.
- src/lib/llm/client.ts       → cliente NVIDIA.
- src/lib/llm/prompt.ts       → system prompt y armado de contexto.
- src/lib/utils/log.ts        → logs con teléfono enmascarado.

Verificación GET: los parámetros son con PUNTO, no con guion bajo:
hub.mode, hub.verify_token, hub.challenge.
Si coinciden, devolver el challenge como texto plano con 200.
Si no, 403.

## 8. Orden de ejecución del agente

TAREA 1 — Estabilizar lo existente
Corregir GET del webhook, filtrar no-texto, manejar statuses, responder 200
ante payloads inválidos con firma válida. Probar con curl y con el celular.

TAREA 2 — Conectar la BD
Instalar Prisma, crear schema arriba, configurar DATABASE_URL de Neon,
generar cliente y aplicar migración. Verificar que se pueda insertar
y leer un Contacto desde un script o endpoint temporal.

TAREA 3 — Idempotencia
Implementar la reserva de MensajeProcesado antes de procesar.
Probar reenviando dos veces el mismo message_id: debe haber UNA sola
respuesta y un solo registro en Mensaje.

TAREA 4 — Memoria y estados
Implementar creación de Contacto, captura de nombre, lectura de los
últimos 10 mensajes y actualización de ultima_interaccion.
Probar reiniciando el servidor de desarrollo: el nombre debe sobrevivir.

TAREA 5 — LLM NVIDIA
Conectar el cliente, el system prompt y el contexto. Probar una pregunta
simple y una fuera de alcance. Verificar que nunca responda vacío.

TAREA 6 — Seguridad y limpieza
Firma HMAC, enmascarado de teléfonos, validación Zod, README con setup.
Eliminar archivos con credenciales. Confirmar que .env está en .gitignore.

## 9. Criterios de aceptación (no se da la fase por terminada sin esto)

Pruebas reales desde un celular:

1. Número nuevo escribe "Hola" → pide el nombre.
2. Responde su nombre → lo saluda por ese nombre.
3. Pregunta algo → responde usando el contexto de la conversación.
4. Se cierra el servidor y se vuelve a escribir → sigue recordando el nombre.
5. Mañana escribe de nuevo → NO vuelve a pedir el nombre.
6. Envía una imagen → responde que solo acepta texto, sin error 500.
7. Envía un audio → mismo comportamiento, sin error 500.
8. Se reenvía el mismo message_id al webhook → una sola respuesta.
9. Se detiene la API del LLM → responde el mensaje de falla, no queda mudo.
10. En los logs no aparece ningún teléfono completo ni ningún token.

Criterio técnico final:
Si se borra la memoria del proceso y el bot sigue reconociendo al usuario
y su historial, la memoria está bien implementada.