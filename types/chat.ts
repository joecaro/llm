export type Message = {
  role: 'assistant' | 'user';
  content: string;
}

export type ChatState = {
  messages: Message[];
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  modelId?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: number;
} 