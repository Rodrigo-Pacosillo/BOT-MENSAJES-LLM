import { z } from "zod";

export const WhatsAppMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().min(1),
  text: z.object({ 
    body: z.string(),
  }),
});

export const WhatsAppChangeSchema = z.object({
  field: z.string(),
  value: z.object({
    messaging_product: z.string(),
    metadata: z.record(z.string(), z.string()).optional(),
    messages: z.array(WhatsAppMessageSchema).optional(),
    statuses: z.array(z.unknown()).optional(),
  }),
});

export const WhatsAppWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(WhatsAppChangeSchema),
    })
  ),
});
