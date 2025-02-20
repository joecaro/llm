"use client";

import { createNewChat } from "@/utils/chat-storage";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat-store";
import { motion, AnimatePresence } from "framer-motion";

export function ChatSidebar() {
  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const addChat = useChatStore.use.addChat();
  const deleteChat = useChatStore.use.deleteChat();
  const setCurrentChatId = useChatStore.use.setCurrentChatId();

  const handleNewChat = () => {
    const newChat = createNewChat();
    addChat(newChat);
  };

  const handleDeleteChat = (chatId: string) => {
    deleteChat(chatId);
  };

  return (
    <div className="w-64 border-r border-white/10 flex flex-col">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <p className="text-white/90">Chats</p>
          <Button onClick={handleNewChat} variant="default" size="icon">
            <PlusIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <motion.div layout className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence mode="popLayout">
          {chats.map((chat) => (
            <motion.div
              layout
              key={chat.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              onClick={() => setCurrentChatId(chat.id)}
              className={cn(
                "text-primary w-full text-left flex items-center justify-between px-4 py-2 rounded-lg cursor-pointer bg-muted/50 transition-colors border border-transparent",
                chat.id === currentChatId && "border-neutral-500"
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
                variant="destructive"
                size="icon"
                className="bg-transparent hover:bg-destructive"
              >
                <TrashIcon className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
