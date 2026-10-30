export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  at: number; // timestamp ms
}

export interface ConversationStore {
  getHistory(phone: string): Promise<ChatTurn[]>;
  addTurn(phone: string, turn: ChatTurn): Promise<void>;
  markProcessed(messageId: string): Promise<boolean>; // true si es nuevo, false si ya existía
  hit(phone: string, windowMs: number): Promise<number>; // cuenta mensajes recientes (rate limit)
}