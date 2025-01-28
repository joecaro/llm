"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  Chat,
  createNewChat,
  saveChat,
  deleteChat,
  getChats,
} from "@/utils/chat-storage";
import { useState, useEffect } from "react";

export function ChatSidebar({
  onChatSelect,
  selectedChat,
}: {
  onChatSelect: (chat: Chat | null) => void;
  selectedChat: Chat | null;
}) {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    const storedChats = getChats();
    setChats(storedChats);
    if (storedChats.length > 0) {
      onChatSelect(storedChats[0]);
    }
  }, [onChatSelect]);

  const handleNewChat = () => {
    const newChat = createNewChat();
    saveChat(newChat);
    setChats((prev) => [newChat, ...prev]);
    onChatSelect(newChat);
  };

  const handleDeleteChat = (chatId: string) => {
    deleteChat(chatId);
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    if (selectedChat?.id === chatId) {
      const remaining = getChats();
      if (remaining.length > 0) {
        onChatSelect(remaining[0]);
      } else {
        onChatSelect(null);
      }
    }
  };

  return (
    <div className="w-80 bg-background border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-md 
            bg-muted/50 hover:bg-muted transition-colors
            text-sm font-medium text-foreground/80 hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {chats.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No chats yet. Start a new conversation!
          </div>
        ) : (
          chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onChatSelect(chat)}
              className={`w-full text-left px-4 py-2.5 text-sm group flex items-center gap-2
                transition-colors
                ${
                  selectedChat?.id === chat.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
            >
              <div className="flex-1 truncate">{chat.title}</div>
              {selectedChat?.id === chat.id && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted/80 
                    rounded transition-all duration-200 text-muted-foreground 
                    hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
