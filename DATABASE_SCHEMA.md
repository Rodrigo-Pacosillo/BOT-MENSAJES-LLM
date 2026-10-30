# DATABASE_SCHEMA.md - Esquema de Base de Datos Aislada (Fase 1)

Este es el esquema de Prisma para la base de datos **Neon** del bot. 
El bot es la "Fuente de la Verdad" solo para su propia memoria de conversación.

## Reglas del Esquema
- Usar `cuid()` para IDs.
- Usar `@map` para mantener convención snake_case en la BD y camelCase en TS.
- El campo `meta_message_id` en `Mensaje` DEBE ser `@unique` para garantizar idempotencia.

## Schema Prisma (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum EstadoContacto {
  visitante
  prospecto
  cliente_consciente
}

model Contacto {
  telefono          String          @id @map("telefono") // Formato E.164 sin +
  nombre            String?         @map("nombre")
  estado            EstadoContacto  @default(visitante) @map("estado")
  ultima_interaccion DateTime       @default(now()) @map("ultima_interaccion")
  creado_en         DateTime        @default(now()) @map("creado_en")
  
  mensajes          Mensaje[]
}

model Mensaje {
  id                String          @id @default(cuid()) @map("id")
  contacto_telefono String          @map("contacto_telefono")
  role              String          @map("role") // "user" o "assistant"
  contenido         String          @map("contenido")
  meta_message_id   String          @unique @map("meta_message_id") // Clave para idempotencia
  creado_en         DateTime        @default(now()) @map("creado_en")

  contacto          Contacto        @relation(fields: [contacto_telefono], references: [telefono], onDelete: Cascade)

  @@index([contacto_telefono])
  @@index([meta_message_id])
}

model BaseConocimiento {
  id                String          @id @default(cuid()) @map("id")
  categoria         String          @map("categoria") // ej: "servicio", "faq", "proceso"
  pregunta_clave    String          @map("pregunta_clave")
  respuesta         String          @map("respuesta")
  url_relacionada   String?         @map("url_relacionada") // ej: "https://app-construccion.vercel.app/cotizaciones"
  activo            Boolean         @default(true) @map("activo")
  creado_en         DateTime        @default(now()) @map("creado_en")
  actualizado_en    DateTime        @updatedAt @map("actualizado_en")

  @@index([categoria])
}