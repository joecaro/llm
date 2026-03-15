import { create, type StoreApi, type UseBoundStore } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Chat,
  ChatActivityEvent,
  ChatArtifacts,
  ChatMessage,
  ChatSession,
} from "@/types/chat";
import { createEmptyChat, createEmptySession, normalizeChat } from "@/utils/create-empty-chat";

interface ChatStore {
  chats: Chat[];
  currentChatId: string | null;
  artifactPanelOpen: boolean;
  activeArtifactPath: string | null;
  artifactView: "code" | "preview";
  storageHydrated: boolean;
  hydrateFromDisk: (params: {
    chats: Chat[];
    currentChatId: string | null;
  }) => void;
  markStorageHydrated: () => void;
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
  setMessageActivities: (
    chatId: string,
    messageId: string,
    activities: ChatActivityEvent[]
  ) => void;
  upsertMessageActivity: (
    chatId: string,
    messageId: string,
    activity: ChatActivityEvent
  ) => void;
  finalizeMessageActivity: (
    chatId: string,
    messageId: string,
    activityId: string,
    patch: Partial<Omit<ChatActivityEvent, "id">>
  ) => void;
  replaceMessageAndTruncateChat: (
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

function pruneArtifactsForMessages(
  chat: Chat,
  retainedMessages: ChatMessage[]
): ChatArtifacts {
  const retainedMessageIds = new Set(retainedMessages.map((message) => message.id));
  const files = Object.fromEntries(
    Object.entries(chat.artifacts.files).filter(([, file]) => {
      return (
        retainedMessageIds.has(file.createdByMessageId) &&
        retainedMessageIds.has(file.updatedByMessageId)
      );
    })
  );

  return {
    files,
    order: chat.artifacts.order.filter((path) => files[path]),
  };
}

function mergeActivityEvent(
  current: ChatActivityEvent,
  patch: Partial<Omit<ChatActivityEvent, "id">> | ChatActivityEvent
): ChatActivityEvent {
  return {
    ...current,
    ...patch,
    detail:
      current.detail || patch.detail
        ? {
            ...(current.detail ?? {}),
            ...(patch.detail ?? {}),
          }
        : undefined,
  };
}

function updateChatMessage(
  chat: Chat,
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage
): Chat {
  if (chat.sessions && chat.sessions.length > 0) {
    let hasUpdated = false;
    const sessions = chat.sessions.map((session) => {
      let sessionUpdated = false;
      const messages = session.messages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        hasUpdated = true;
        sessionUpdated = true;
        return updater(message);
      });

      return sessionUpdated ? { ...session, messages } : session;
    });

    if (!hasUpdated) {
      return chat;
    }

    return {
      ...chat,
      sessions,
      messages: getAllMessagesFromSessions(sessions),
    };
  }

  let hasUpdated = false;
  const messages = chat.messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    hasUpdated = true;
    return updater(message);
  });

  if (!hasUpdated) {
    return chat;
  }

  return {
    ...chat,
    messages,
  };
}

function replaceMessageAndTruncate(
  chat: Chat,
  messageId: string,
  content: string
): Chat {
  const baseSessions =
    chat.sessions && chat.sessions.length > 0
      ? chat.sessions
      : [{ id: "migrated", messages: chat.messages }];

  const targetSessionIndex = baseSessions.findIndex((session) =>
    session.messages.some((message) => message.id === messageId)
  );

  if (targetSessionIndex === -1) {
    return chat;
  }

  const targetSession = baseSessions[targetSessionIndex];
  const targetMessageIndex = targetSession.messages.findIndex(
    (message) => message.id === messageId
  );

  if (targetMessageIndex === -1) {
    return chat;
  }

  const sessions = baseSessions
    .slice(0, targetSessionIndex + 1)
    .map((session, index) => {
      if (index !== targetSessionIndex) {
        return {
          ...session,
          messages: [...session.messages],
        };
      }

      return {
        ...session,
        messages: session.messages
          .slice(0, targetMessageIndex + 1)
          .map((message) =>
            message.id === messageId ? { ...message, content } : message
          ),
      };
    });

  const messages = getAllMessagesFromSessions(sessions);

  return {
    ...chat,
    sessions,
    messages,
    artifacts: pruneArtifactsForMessages(chat, messages),
  };
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
  devtools((set) => ({
    chats: [],
    currentChatId: null,
    artifactPanelOpen: false,
    activeArtifactPath: null,
    artifactView: "code",
    storageHydrated: false,
    hydrateFromDisk: ({ chats, currentChatId }) =>
      set(() => {
        const normalizedChats = chats.map(normalizeChat);
        const selectedChat =
          normalizedChats.find((chat) => chat.id === currentChatId) ??
          normalizedChats[0] ??
          null;

        return {
          chats: normalizedChats,
          currentChatId: selectedChat?.id ?? null,
          artifactPanelOpen: false,
          activeArtifactPath: getNextActiveArtifactPath(selectedChat ?? undefined, null),
          artifactView: "code" as const,
          storageHydrated: true,
        };
      }),
    markStorageHydrated: () => set({ storageHydrated: true }),
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
        chats: [
          normalizedChat,
          ...state.chats.filter((existingChat) => existingChat.id !== normalizedChat.id),
        ],
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
      set((state) => {
        const chats = state.chats.filter((chat) => chat.id !== chatId);
        const nextCurrentChatId =
          state.currentChatId === chatId ? chats[0]?.id ?? null : state.currentChatId;
        const currentChat = chats.find((chat) => chat.id === nextCurrentChatId);

        return {
          chats,
          currentChatId: nextCurrentChatId,
          artifactPanelOpen:
            state.currentChatId === chatId ? false : state.artifactPanelOpen,
          activeArtifactPath: getNextActiveArtifactPath(
            currentChat,
            state.currentChatId === chatId ? null : state.activeArtifactPath
          ),
        };
      }),
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

          return updateChatMessage(chat, messageId, (message) => ({
            ...message,
            content,
          }));
        }),
      })),
    setMessageActivities: (chatId, messageId, activities) =>
      set((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat;

          return updateChatMessage(chat, messageId, (message) => ({
            ...message,
            activities: activities.length > 0 ? [...activities] : undefined,
          }));
        }),
      })),
    upsertMessageActivity: (chatId, messageId, activity) =>
      set((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat;

          return updateChatMessage(chat, messageId, (message) => {
            const activities = [...(message.activities ?? [])];
            const existingIndex = activities.findIndex(
              (candidate) => candidate.id === activity.id
            );

            if (existingIndex === -1) {
              activities.push(activity);
            } else {
              activities[existingIndex] = mergeActivityEvent(
                activities[existingIndex],
                activity
              );
            }

            return {
              ...message,
              activities,
            };
          });
        }),
      })),
    finalizeMessageActivity: (chatId, messageId, activityId, patch) =>
      set((state) => ({
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat;

          return updateChatMessage(chat, messageId, (message) => {
            const activities = [...(message.activities ?? [])];
            const existingIndex = activities.findIndex(
              (candidate) => candidate.id === activityId
            );

            if (existingIndex === -1) {
              return message;
            }

            activities[existingIndex] = mergeActivityEvent(
              activities[existingIndex],
              patch
            );

            return {
              ...message,
              activities,
            };
          });
        }),
      })),
    replaceMessageAndTruncateChat: (chatId, messageId, content) =>
      set((state) => {
        const chats = state.chats.map((chat) =>
          chat.id === chatId
            ? replaceMessageAndTruncate(chat, messageId, content)
            : chat
        );
        const updatedChat = chats.find((chat) => chat.id === chatId);

        return {
          chats,
          activeArtifactPath:
            state.currentChatId === chatId
              ? getNextActiveArtifactPath(updatedChat, state.activeArtifactPath)
              : state.activeArtifactPath,
          artifactPanelOpen:
            state.currentChatId === chatId
              ? Boolean(updatedChat?.artifacts.order.length)
              : state.artifactPanelOpen,
        };
      }),
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
  }))
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
