# PHASE_1_TASKS.md - Lista de Tareas Ejecutables

Agente: Ejecuta estas tareas en orden estricto. No saltes a la Tarea 3 sin que la 1 y 2 estén funcionando y commiteadas.

## Tarea 1: Estabilización del Webhook (URGENTE)
- [ ] Modificar `src/app/api/webhook/route.ts` (GET): Cambiar `hub_mode` por `hub.mode`, `hub_verify_token` por `hub.verify_token`, `hub_challenge` por `hub.challenge`.
- [ ] Modificar `src/app/api/webhook/route.ts` (POST): Agregar validación con Zod. Si el mensaje no es `type === "text"`, registrar en consola y devolver `200 OK` sin procesar.
- [ ] Asegurar que los logs enmascaren el teléfono (ej: `tel.replace(/(\d{4})\d{4}(\d{4})/, '$1****$2')`).

## Tarea 2: Configuración de Base de Datos (Neon + Prisma)
- [ ] Ejecutar `pnpm add prisma @prisma/client` y `pnpm add -D prisma`.
- [ ] Ejecutar `pnpm dlx prisma init`.
- [ ] Copiar el contenido de `DATABASE_SCHEMA.md` en `prisma/schema.prisma`.
- [ ] Actualizar `.env.example` para incluir `DATABASE_URL="postgresql://..."`.
- [ ] Crear `src/lib/db.ts` con el patrón Singleton para Prisma (evitar múltiples instancias en dev).
- [ ] Ejecutar `pnpm dlx prisma generate` y `pnpm dlx prisma db push`.

## Tarea 3: Idempotencia y Persistencia de Mensajes
- [ ] Crear `src/lib/whatsapp/message-handler.ts`.
- [ ] Antes de procesar cualquier mensaje, consultar en Prisma: `await prisma.mensaje.findUnique({ where: { meta_message_id: payload.id } })`.
- [ ] Si existe, devolver `200 OK` inmediatamente (duplicado de Meta).
- [ ] Si no existe, guardar el mensaje del usuario en la tabla `Mensaje` y actualizar `ultima_interaccion` en `Contacto`.

## Tarea 4: Integración LLM NVIDIA y Comportamiento
- [ ] Actualizar `src/lib/llm/index.ts` (o el archivo equivalente) para usar `LLM_BASE_URL` (ej: `https://integrate.api.nvidia.com/v1`) y `LLM_API_KEY`.
- [ ] Implementar la lógica de `BOT_BEHAVIOR.md`: consultar el `estado` del contacto antes de armar el prompt.
- [ ] Si es `visitante`, interceptar y pedir el nombre sin llamar al LLM.
- [ ] Si es `prospecto` o `cliente_consciente`, inyectar el System Prompt y las URLs correspondientes en el contexto del LLM.

## Tarea 5: Limpieza y Documentación
- [ ] Eliminar `env.txt` del repositorio.
- [ ] Asegurar que `.env` esté en `.gitignore`.
- [ ] Crear/Actualizar `README.md` con instrucciones de: 1) Crear DB en Neon, 2) Copiar `.env.example`, 3) `pnpm install`, 4) `pnpm prisma db push`, 5) `pnpm dev`.

---
**Instrucción para el Agente:** Comienza por la **Tarea 1**. Muéstrame el código propuesto para `route.ts` antes de aplicarlo.