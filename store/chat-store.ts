import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { type StoreApi, type UseBoundStore } from "zustand";
import type { Chat, ChatArtifacts, ChatMessage, ChatSession } from "@/types/chat";
import { createEmptyChat, createEmptySession, normalizeChat } from "@/utils/create-empty-chat";

interface ChatStore {
  chats: Chat[];
  currentChatId: string | null;
  artifactPanelOpen: boolean;
  activeArtifactPath: string | null;
  artifactView: "code" | "preview";
  setCurrentChatId: (id: string | null) => void;
  setChatArtifacts: (chatId: string, artifacts: ChatArtifacts) => void;
  setArtifactPanelOpen: (open: boolean) => void;
  setActiveArtifactPath: (path: string | null) => void;
  setArtifactView: (view: "code" | "preview") => void;
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

function getAllMessagesFromSessions(sessions: ChatSession[]): ChatMessage[] {
  return sessions.flatMap((session) => session.messages);
}

function getNextActiveArtifactPath(
  chat: Chat | undefined,
  currentPath: string | null
): string | null {
  if (!chat || chat.artifacts.order.length === 0) {
    return null;
  }

  if (currentPath && chat.artifacts.files[currentPath]) {
    return currentPath;
  }

  return chat.artifacts.order[0] ?? null;
}

export function getCurrentSession(chat: Chat): ChatSession {
  if (chat.sessions && chat.sessions.length > 0) {
    return chat.sessions[chat.sessions.length - 1];
  }

  return {
    id: "default",
    messages: chat.messages,
  };
}

export function getAllMessages(chat: Chat): ChatMessage[] {
  if (chat.sessions && chat.sessions.length > 0) {
    return chat.sessions.flatMap((session) => session.messages);
  }

  return chat.messages;
}

const useChatStoreBase = create<ChatStore>()(
  devtools(
    persist(
      (set) => ({
        chats: [],
        currentChatId: null,
        artifactPanelOpen: false,
        activeArtifactPath: null,
        artifactView: "code",
        setCurrentChatId: (id) =>
          set((state) => {
            const nextChat = state.chats.find((chat) => chat.id === id);
            const hasArtifacts = Boolean(nextChat && nextChat.artifacts.order.length > 0);

            return {
              currentChatId: id,
              artifactPanelOpen: hasArtifacts ? state.artifactPanelOpen : false,
              activeArtifactPath: hasArtifacts
                ? getNextActiveArtifactPath(nextChat, state.activeArtifactPath)
                : null,
            };
          }),
        setChatArtifacts: (chatId, artifacts) =>
          set((state) => {
            const chats = state.chats.map((chat) =>
              chat.id === chatId ? { ...chat, artifacts } : chat
            );
            const updatedChat = chats.find((chat) => chat.id === chatId);
            return {
              chats,
              activeArtifactPath:
                state.currentChatId === chatId
                  ? getNextActiveArtifactPath(updatedChat, state.activeArtifactPath)
                  : state.activeArtifactPath,
              artifactPanelOpen:
                state.currentChatId === chatId && artifacts.order.length === 0
                  ? false
                  : state.artifactPanelOpen,
            };
          }),
        setArtifactPanelOpen: (open) => set({ artifactPanelOpen: open }),
        setActiveArtifactPath: (path) => set({ activeArtifactPath: path }),
        setArtifactView: (view) => set({ artifactView: view }),
        addChat: (chat) => {
          const normalizedChat = normalizeChat(chat);
          set((state) => ({
            chats: [normalizedChat, ...state.chats.filter((existingChat) => existingChat.id !== normalizedChat.id)],
            currentChatId: normalizedChat.id,
            artifactPanelOpen: false,
            activeArtifactPath: getNextActiveArtifactPath(normalizedChat, null),
            artifactView: "code",
          }));
        },
        createNewChat: () => {
          const newChat = createEmptyChat();

          set((state) => ({
            chats: [newChat, ...state.chats],
            currentChatId: newChat.id,
            artifactPanelOpen: false,
            activeArtifactPath: null,
            artifactView: "code",
          }));

          return newChat;
        },
        updateChat: (chat) => {
          const normalizedChat = normalizeChat(chat);
          set((state) => ({
            chats: state.chats.map((existingChat) =>
              existingChat.id === normalizedChat.id ? normalizedChat : existingChat
            ),
          }));
        },
        deleteChat: (chatId) =>
          set((state) => ({
            chats: state.chats.filter((chat) => chat.id !== chatId),
            currentChatId:
              state.currentChatId === chatId ? null : state.currentChatId,
            artifactPanelOpen:
              state.currentChatId === chatId ? false : state.artifactPanelOpen,
            activeArtifactPath:
              state.currentChatId === chatId ? null : state.activeArtifactPath,
          })),
        updateChatTitle: (chatId, title) =>
          set((state) => ({
            chats: state.chats.map((chat) =>
              chat.id === chatId ? { ...chat, title } : chat
            ),
          })),
        addMessageToChat: (chatId, message) =>
          set((state) => ({
            chats: state.chats.map((chat) => {
              if (chat.id !== chatId) return chat;

              if (chat.sessions && chat.sessions.length > 0) {
                const sessions = [...chat.sessions];
                const lastSession = { ...sessions[sessions.length - 1] };
                lastSession.messages = [...lastSession.messages, message];
                sessions[sessions.length - 1] = lastSession;
                return {
                  ...chat,
                  sessions,
                  messages: getAllMessagesFromSessions(sessions),
                };
              }

              return { ...chat, messages: [...chat.messages, message] };
            }),
          })),
        updateMessageInChat: (chatId, messageId, content) =>
          set((state) => ({
            chats: state.chats.map((chat) => {
              if (chat.id !== chatId) return chat;

              if (chat.sessions && chat.sessions.length > 0) {
                const sessions = chat.sessions.map((session) => ({
                  ...session,
                  messages: session.messages.map((message) =>
                    message.id === messageId ? { ...message, content } : message
                  ),
                }));

                return {
                  ...chat,
                  sessions,
                  messages: getAllMessagesFromSessions(sessions),
                };
              }

              return {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === messageId ? { ...message, content } : message
                ),
              };
            }),
          })),
        compactChat: (chatId, summary) =>
          set((state) => ({
            chats: state.chats.map((chat) => {
              if (chat.id !== chatId) return chat;

              const oldSessions =
                chat.sessions && chat.sessions.length > 0
                  ? chat.sessions
                  : [{ id: "migrated", messages: chat.messages }];

              const archivedSessions = oldSessions.map((session, index) =>
                index === oldSessions.length - 1 ? { ...session, summary } : session
              );

              const sessions = [...archivedSessions, createEmptySession()];

              return {
                ...chat,
                sessions,
                messages: getAllMessagesFromSessions(sessions),
              };
            }),
          })),
        clearMessagesInChat: (chatId) =>
          set((state) => ({
            chats: state.chats.map((chat) =>
              chat.id === chatId
                ? {
                    ...chat,
                    messages: [],
                    sessions: [createEmptySession()],
                  }
                : chat
            ),
          })),
      }),
      {
        name: "ai-chats",
        version: 2,
        partialize: (state) => ({
          chats: state.chats,
          currentChatId: state.currentChatId,
        }),
        migrate: (persistedState) => {
          const state = persistedState as
            | Partial<Pick<ChatStore, "chats" | "currentChatId">>
            | undefined;

          return {
            chats: Array.isArray(state?.chats) ? state.chats.map(normalizeChat) : [],
            currentChatId: state?.currentChatId ?? null,
            artifactPanelOpen: false,
            activeArtifactPath: null,
            artifactView: "code" as const,
          };
        },
      }
    )
  )
);

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  baseStore: S
) => {
  const store = baseStore as WithSelectors<typeof baseStore>;
  store.use = {};

  for (const key of Object.keys(store.getState())) {
    (store.use as Record<string, unknown>)[key] = () =>
      store((state) => state[key as keyof typeof state]);
  }

  return store;
};

const useChatStore = createSelectors(useChatStoreBase);

export { useChatStore };
