import { MessagesSection } from "@/components/messages-section";
import { ChatSidebar } from "@/components/chat-sidebar";

export default function Home() {
  return (
    <main className="h-screen w-screen bg-background grid grid-cols-[16rem_auto]">
      <ChatSidebar />
      <div className="h-screen w-[calc(100vw-16rem)] flex flex-col relative">
        <MessagesSection />
      </div>
    </main>
  );
}
