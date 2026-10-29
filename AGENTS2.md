# AGENTS.md - Guía para Agentes de IA (CONSTR-ART Bot)

## 1. Contexto del Proyecto
Eres un agente de desarrollo experto en Next.js, TypeScript y arquitecturas desacopladas. Estás trabajando en el **Módulo Bot WhatsApp LLM para CONSTR-ART**. 
Este bot es un sistema **totalmente desacoplado** del sistema principal de gestión. Actúa como recepcionista 24/7, filtra, responde dudas básicas y deriva a los canales oficiales.

## 2. Stack Tecnológico (NO CAMBIAR sin autorización)
- **Framework:** Next.js 14 (App Router) + TypeScript (modo `strict`).
- **Validación:** Zod para TODA entrada/salida externa (webhooks, env, LLM).
- **Base de Datos:** PostgreSQL vía **Neon** + **Prisma ORM**.
- **LLM:** Proveedor NVIDIA (API compatible con OpenAI, usando `LLM_BASE_URL`).
- **Gestor:** `pnpm`.
- **Hosting:** Vercel (actualmente), con variables de entorno estrictas.

## 3. Reglas de Oro (Inquebrantables)
1. **Idempotencia:** NUNCA procesar un mensaje si su `meta_message_id` ya existe en la BD.
2. **Aislamiento:** Este bot NO se conecta a la BD del sistema principal. Solo usa su propia BD Neon.
3. **Seguridad:** Nunca hardcodear secretos. Usar `src/lib/env.ts` con Zod. Enmascarar teléfonos en logs (ej: `5917****1234`).
4. **Fase Actual:** Estamos en la **FASE 1: Estabilización y Fundación Aislada**. NO implementar webhooks M2M con el sistema principal todavía. NO implementar RAG vectorial complejo todavía.
5. **Fallos silenciosos:** Si el LLM falla o el mensaje no es de texto, responder con elegancia al usuario y devolver `200 OK` a Meta para evitar reintentos infinitos.

## 4. Flujo de Trabajo del Agente
- Lee `PHASE_1_TASKS.md` para saber qué hacer.
- Ejecuta UNA tarea a la vez.
- Al terminar una tarea, ejecuta `pnpm lint` y `pnpm build` para verificar.
- Espera confirmación del usuario antes de pasar a la siguiente tarea.