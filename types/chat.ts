export type Message = {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

export type ChatState = {
  messages: Message[];
}

export type ArtifactLanguage =
  | 'tsx'
  | 'jsx'
  | 'css'
  | 'js'
  | 'ts'
  | 'html'
  | 'json'
  | 'text';

export interface ChatArtifactFile {
  path: string;
  language: ArtifactLanguage;
  content: string;
  createdAt: number;
  updatedAt: number;
  createdByMessageId: string;
  updatedByMessageId: string;
}

export interface ChatArtifacts {
  files: Record<string, ChatArtifactFile>;
  order: string[];
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
  artifacts: ChatArtifacts;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: number;
}
