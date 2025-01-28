"use client";

import { MessagesSection } from '@/components/messages-section';
import { ChatSidebar } from '@/components/chat-sidebar';
import { Chat } from '@/utils/chat-storage';
import { useState } from 'react';

export default function Home() {
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);

  return (
    <main className="flex h-screen bg-background">
      <ChatSidebar onChatSelect={setCurrentChat} selectedChat={currentChat} />
      <div className="flex-1 flex flex-col relative">
        <MessagesSection chat={currentChat} />
      </div>
    </main>
  );
}
