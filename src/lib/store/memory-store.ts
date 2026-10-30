import { ChatTurn, ConversationStore } from "./types";

const MAX_TURNS = 10;
const CONVERSATION_TTL = 2 * 60 * 60 * 1000; // 2 horas en ms
const PROCESSED_TTL = 60 * 60 * 1000; // 1 hora en ms

const historyStore = new Map<string, ChatTurn[]>();
const processedStore = new Map<string, number>();

export const memoryStore: ConversationStore = {
  async getHistory(phone: string): Promise<ChatTurn[]> {
    const turns = historyStore.get(phone) || [];
    // Limpiar turnos expirados
    const now = Date.now();
    const filtered = turns.filter((turn) => now - turn.at < CONVERSATION_TTL);
    // Mantener solo los ultimos MAX_TURNS
    const recent = filtered.slice(-MAX_TURNS);
    historyStore.set(phone, recent);
    return recent;
  },

  async addTurn(phone: string, turn: ChatTurn): Promise<void> {
    const now = Date.now();
    const turns = historyStore.get(phone) || [];
    // Agregar nuevo turno y mantener orden cronologico inverso (mas reciente primero)
    const updated = [turn, ...turns].slice(0, MAX_TURNS);
    historyStore.set(phone, updated);
  },

  async markProcessed(messageId: string): Promise<boolean> {
    const now = Date.now();
    const existingTime = processedStore.get(messageId);

    if (existingTime) {
      // Ya existe, verificar si ha expirado (TTL 1 hora)
      if (now - existingTime < PROCESSED_TTL) {
        return false; // Aun es reciente, es duplicado
      }
    }

    // Guardar como procesado
    processedStore.set(messageId, now);

    return true; // Es un mensaje nuevo
  },

  async hit(phone: string, windowMs: number): Promise<number> {
    // Simplified: no persiste across executions en este entorno
    return 1;
  }
};