export type Message = {
  role: 'assistant' | 'user';
  content: string;
}

export type ChatState = {
  messages: Message[];
} 