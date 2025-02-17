import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";
import { Chat, ChatMessage } from "@/types/chat";

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
}

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
          const newChat = {
            id: crypto.randomUUID(),
            title: "New Chat",
            messages: [],
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
            chats: state.chats.map((c) =>
              c.id === chatId ? { ...c, messages: [...c.messages, message] } : c
            ),
          })),
        updateMessageInChat: (chatId, messageId, content) =>
          set((state) => ({
            chats: state.chats.map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === messageId ? { ...m, content } : m
                    ),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

const useChatStore = createSelectors(useChatStoreBase);

export { useChatStore };
