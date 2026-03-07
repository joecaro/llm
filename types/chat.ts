export type Message = {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

export type ChatState = {
  messages: Message[];
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  summary?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  sessions?: ChatSession[];
  createdAt: number;
  modelId?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: number;
}
