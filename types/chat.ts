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
  | 'md'
  | 'csv'
  | 'text';

export interface ChatArtifactFile {
  path: string;
  language: ArtifactLanguage;
  content: string;
  description?: string;
  kind?: string;
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

export type ChatActivityKind =
  | 'phase'
  | 'artifact_request'
  | 'artifact_result'
  | 'tool_call'
  | 'tool_result'
  | 'protocol_retry'
  | 'finalize';

export type ChatActivityStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface ChatActivityDetail {
  toolName?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  artifactPaths?: string[];
  pass?: number;
  durationMs?: number;
}

export interface ChatActivityEvent {
  id: string;
  kind: ChatActivityKind;
  status: ChatActivityStatus;
  label: string;
  startedAt: number;
  endedAt?: number;
  detail?: ChatActivityDetail;
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
  activities?: ChatActivityEvent[];
}
