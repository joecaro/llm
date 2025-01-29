import { MessagesSection } from "@/components/messages-section";
import { ChatSidebar } from "@/components/chat-sidebar";

export default function Home() {
  return (
    <main className="flex h-screen bg-background">
      <ChatSidebar />
      <div className="flex-1 flex flex-col relative">
        <MessagesSection />
      </div>
    </main>
  );
}
