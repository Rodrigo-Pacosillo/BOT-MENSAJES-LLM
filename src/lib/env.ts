import { z } from "zod";

const EnvSchema = z.object({
  META_ACCESS_TOKEN: z.string().min(1),
  META_PHONE_NUMBER_ID: z.string().min(1),
  META_VERIFY_TOKEN: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_GRAPH_VERSION: z.string().default("v26.0"),
  // Inyectadas en Vercel; opcionales en desarrollo local
  DATABASE_URL: z.string().optional(),
  LLM_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().optional(),
  APP_URL: z.string().optional(),
  // Mantener por compatibilidad con llm/index.ts hasta migrar a client.ts (TAREA 5)
  LLM_PROVIDER: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const faltantes = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
  console.error("[env] Faltan variables de entorno requeridas:", faltantes);
  throw new Error(`Faltan variables de entorno requeridas: ${faltantes}`);
}

export type Env = z.infer<typeof EnvSchema>;
export const env: Env = parsed.data;
