export function logWebhook(message: string, meta?: Record<string, unknown>) {
  const telefono = meta?.telefono ? ` tel=${mascararTelefono(String(meta.telefono))}` : "";
  const extra = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[webhook] ${message}${telefono}${extra}`);
}

export function logLlm(message: string, meta?: Record<string, unknown>) {
  const extra = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[llm] ${message}${extra}`);
}

export function logWhatsapp(message: string, meta?: Record<string, unknown>) {
  const telefono = meta?.telefono ? ` tel=${mascararTelefono(String(meta.telefono))}` : "";
  const extra = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[whatsapp] ${message}${telefono}${extra}`);
}

export function logContacts(message: string, meta?: Record<string, unknown>) {
  const telefono = meta?.telefono ? ` tel=${mascararTelefono(String(meta.telefono))}` : "";
  const extra = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[contacts] ${message}${telefono}${extra}`);
}

function mascararTelefono(telefono: string): string {
  if (!telefono) return "";
  const visible = 4;
  return "*".repeat(Math.max(0, telefono.length - visible)) + telefono.slice(-visible);
}
