import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";
import { Chat, ChatMessage, ChatSession } from "@/types/chat";

interface ChatStore {
  chats: Chat[];
  currentChatId: string | null;
  setCurrentChatId: (id: string | null) => void;
  addChat: (chat: Chat) => void;
  createNewChat: () => Chat;
  updateChat: (chat: Chat) => void;
  deleteChat: (chatId: string) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  addMessageToChat: (chatId: string, message: ChatMessage) => void;
  updateMessageInChat: (
    chatId: string,
    messageId: string,
    content: string
  ) => void;
  compactChat: (chatId: string, summary: string) => void;
  clearMessagesInChat: (chatId: string) => void;
}

function getCurrentSession(chat: Chat): ChatSession {
  if (chat.sessions && chat.sessions.length > 0) {
    return chat.sessions[chat.sessions.length - 1];
  }
  return { id: "default", messages: chat.messages };
}

function getAllMessages(chat: Chat): ChatMessage[] {
  if (chat.sessions && chat.sessions.length > 0) {
    return chat.sessions.flatMap((s) => s.messages);
  }
  return chat.messages;
}

export { getCurrentSession, getAllMessages };

const useChatStoreBase = create<ChatStore>()(
  devtools(
    persist(
      (set) => ({
        chats: [],
        currentChatId: null,
        setCurrentChatId: (id) => set({ currentChatId: id }),
        addChat: (chat) =>
          set((state) => ({
            chats: [...state.chats, chat],
            currentChatId: chat.id,
          })),
        createNewChat: () => {
          const newChat: Chat = {
            id: crypto.randomUUID(),
            title: "New Chat",
            messages: [],
            sessions: [{ id: crypto.randomUUID(), messages: [] }],
            createdAt: Date.now(),
          };

          set((state) => ({
            chats: [newChat, ...state.chats],
            currentChatId: newChat.id,
          }));

          return newChat;
        },
        updateChat: (chat) =>
          set((state) => ({
            chats: state.chats.map((c) => (c.id === chat.id ? chat : c)),
          })),
        deleteChat: (chatId) =>
          set((state) => ({
            chats: state.chats.filter((c) => c.id !== chatId),
            currentChatId:
              state.currentChatId === chatId ? null : state.currentChatId,
          })),
        updateChatTitle: (chatId, title) =>
          set((state) => ({
            chats: state.chats.map((c) =>
              c.id === chatId ? { ...c, title } : c
            ),
          })),
        addMessageToChat: (chatId, message) =>
          set((state) => ({
            chats: state.chats.map((c) => {
              if (c.id !== chatId) return c;
              if (c.sessions && c.sessions.length > 0) {
                const sessions = [...c.sessions];
                const last = { ...sessions[sessions.length - 1] };
                last.messages = [...last.messages, message];
                sessions[sessions.length - 1] = last;
                return { ...c, sessions, messages: getAllMessagesFromSessions(sessions) };
              }
              return { ...c, messages: [...c.messages, message] };
            }),
          })),
        updateMessageInChat: (chatId, messageId, content) =>
          set((state) => ({
            chats: state.chats.map((c) => {
              if (c.id !== chatId) return c;
              if (c.sessions && c.sessions.length > 0) {
                const sessions = c.sessions.map((s) => ({
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, content } : m
                  ),
                }));
                return { ...c, sessions, messages: getAllMessagesFromSessions(sessions) };
              }
              return {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, content } : m
                ),
              };
            }),
          })),
        compactChat: (chatId, summary) =>
          set((state) => ({
            chats: state.chats.map((c) => {
              if (c.id !== chatId) return c;
              const oldSessions = c.sessions && c.sessions.length > 0
                ? c.sessions
                : [{ id: "migrated", messages: c.messages }];
              // Mark the last session with the summary
              const archivedSessions = oldSessions.map((s, i) =>
                i === oldSessions.length - 1 ? { ...s, summary } : s
              );
              const newSession: ChatSession = {
                id: crypto.randomUUID(),
                messages: [],
              };
              const sessions = [...archivedSessions, newSession];
              return { ...c, sessions, messages: getAllMessagesFromSessions(sessions) };
            }),
          })),
        clearMessagesInChat: (chatId) =>
          set((state) => ({
            chats: state.chats.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    messages: [],
                    sessions: [{ id: crypto.randomUUID(), messages: [] }],
                  }
                : c
            ),
          })),
      }),
      {
        name: "ai-chats",
      }
    )
  )
);

function getAllMessagesFromSessions(sessions: ChatSession[]): ChatMessage[] {
  return sessions.flatMap((s) => s.messages);
}

import { StoreApi, UseBoundStore } from "zustand";

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

const useChatStore = createSelectors(useChatStoreBase);

export { useChatStore };
