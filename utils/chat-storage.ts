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

const CHATS_STORAGE_KEY = 'ai-chats';

export function getChats(): Chat[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(CHATS_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse stored chats:', e);
    return [];
  }
}

export function saveChat(chat: Chat): void {
  const chats = getChats();
  const existingIndex = chats.findIndex(c => c.id === chat.id);
  
  if (existingIndex >= 0) {
    chats[existingIndex] = chat;
  } else {
    chats.unshift(chat); // Add new chats to the beginning
  }
  
  localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
}

export function deleteChat(chatId: string): void {
  const chats = getChats();
  const filtered = chats.filter(chat => chat.id !== chatId);
  localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(filtered));
}

export function createNewChat(modelId?: string): Chat {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    modelId
  };
}

export function updateChatTitle(chatId: string, title: string): void {
  const chats = getChats();
  const chat = chats.find(c => c.id === chatId);
  if (chat) {
    chat.title = title;
    saveChat(chat);
  }
} 