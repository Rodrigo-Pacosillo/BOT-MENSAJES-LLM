import { z } from "zod";

const EnvSchema = z.object({
  META_ACCESS_TOKEN: z.string().min(1),
  META_PHONE_NUMBER_ID: z.string().min(1),
  META_VERIFY_TOKEN: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_GRAPH_VERSION: z.string().default("v20.0"),
  LLM_PROVIDER: z.enum(["openai", "groq", "z.ai", "openrouter"]).default("openai"),
  LLM_API_KEY: z.string().min(1),
  LLM_BASE_URL: z.string().optional(),
  LLM_MODEL: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "[env] Variables de entorno invalidas:",
    parsed.error.flatten().fieldErrors
  );
  throw new Error("Variables de entorno invalidas");
}

export const env: Env = parsed.data;
