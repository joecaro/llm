"use client";

import { createNewChat } from "@/utils/chat-storage";
import { Search, SquarePen, TrashIcon, X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Input } from "./ui/input";
import { SettingsDialog } from "./settings-dialog";

interface ChatSidebarProps {
  onClose?: () => void;
}

export function ChatSidebar({ onClose }: ChatSidebarProps) {
  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const addChat = useChatStore.use.addChat();
  const deleteChat = useChatStore.use.deleteChat();
  const setCurrentChatId = useChatStore.use.setCurrentChatId();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleNewChat = () => {
    const newChat = createNewChat();
    addChat(newChat);
  };

  const handleDeleteChat = (chatId: string) => {
    deleteChat(chatId);
  };

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 h-full border-r border-border flex flex-col bg-background">
      <div className="p-4 border-b border-border space-y-2">
        <div className="flex items-center justify-end gap-2">
          <span className="flex items-center gap-2">
            <span className="flex-1">
              <motion.div
                animate={{
                  width: isSearching ? "100%" : "32px",
                  opacity: isSearching ? 1 : 0.7,
                }}
                transition={{ duration: 0.2 }}
                className="relative flex items-center"
              >
                <AnimatePresence mode="wait">
                  {isSearching ? (
                    <motion.div
                      key="search-input"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex items-center w-full"
                    >
                      <Input
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setSearchQuery(e.target.value)
                        }
                        placeholder="Search chats..."
                        className="w-full p-1"
                      />
                      <Button
                        onClick={() => {
                          setIsSearching(false);
                          setSearchQuery("");
                        }}
                        variant="ghost"
                        size="icon"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  ) : (
                    <Button
                      onClick={() => setIsSearching(true)}
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  )}
                </AnimatePresence>
              </motion.div>
            </span>
            <Button onClick={handleNewChat} variant="ghost" size="icon">
              <SquarePen className="w-4 h-4" />
            </Button>
          </span>
        </div>
      </div>
      <motion.div layout className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredChats.map((chat) => (
            <motion.div
              layout
              key={chat.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setCurrentChatId(chat.id);
                onClose?.();
              }}
              className={cn(
                "text-primary w-full text-left flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer bg-midground transition-colors border border-border",
                chat.id === currentChatId && "border-border"
              )}
            >
              <motion.span layout="position" className="truncate">
                {chat.title}
              </motion.span>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(chat.id);
                }}
                variant="ghost"
                size="icon"
                className="bg-transparent hover:bg-destructive"
              >
                <TrashIcon className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      <div className="p-4 border-t border-border">
        <SettingsDialog />
      </div>
    </div>
  );
}
