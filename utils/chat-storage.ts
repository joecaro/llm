import type { Chat } from "@/types/chat";
import { createEmptyChat, normalizeChat } from "@/utils/create-empty-chat";

const CHATS_STORAGE_KEY = "ai-chats";

export function getChats(): Chat[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(CHATS_STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeChat) : [];
  } catch (error) {
    console.error("Failed to parse stored chats:", error);
    return [];
  }
}

export function saveChat(chat: Chat): void {
  const chats = getChats();
  const normalizedChat = normalizeChat(chat);
  const existingIndex = chats.findIndex((existingChat) => existingChat.id === normalizedChat.id);

  if (existingIndex >= 0) {
    chats[existingIndex] = normalizedChat;
  } else {
    chats.unshift(normalizedChat);
  }

  localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
}

export function deleteChat(chatId: string): void {
  const chats = getChats();
  const filteredChats = chats.filter((chat) => chat.id !== chatId);
  localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(filteredChats));
}

export function createNewChat(modelId?: string): Chat {
  return createEmptyChat(modelId);
}

export function updateChatTitle(chatId: string, title: string): void {
  const chats = getChats();
  const chat = chats.find((candidate) => candidate.id === chatId);

  if (!chat) return;

  chat.title = title;
  saveChat(chat);
}
