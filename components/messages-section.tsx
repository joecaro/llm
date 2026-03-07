"use client";

import { useRef, useState } from "react";
import { MessageContent } from "./message-content";
import { MessageReasoning } from "./message-reasoning";
import { parseMessageContent } from "@/utils/message-parser";
import UserInput from "./user-input";
import { ModelId } from "./model-selector";
import { DEFAULT_CHAT_MESSAGE } from "@/utils/constants";
import { useChatStore, getCurrentSession, getAllMessages } from "@/store/chat-store";
import useScrollToBottom from "@/lib/use-scroll-to-bottom";
import { fetchCompletion, streamCompletion, type StreamStats } from "@/fetches/completion";
import { ChatStatsBar } from "./chat-stats-bar";
import type { ChatSession } from "@/types/chat";

export function MessagesSection({ hideSelector = false, context = "" }: { hideSelector?: boolean, context?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("qwen2.5:7b");
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const isStreaming = useRef(false);

  const currentChatId = useChatStore.use.currentChatId();
  const addMessageToChat = useChatStore.use.addMessageToChat();
  const updateMessageInChat = useChatStore.use.updateMessageInChat();
  const updateChatTitle = useChatStore.use.updateChatTitle();
  const compactChat = useChatStore.use.compactChat();
  const clearMessagesInChat = useChatStore.use.clearMessagesInChat();
  const chat = useChatStore.use.chats().find((c) => c.id === currentChatId);

  useScrollToBottom({
    chatContainerRef,
    isStreaming: isStreaming.current,
    chat,
  });

  const createNewChat = useChatStore.use.createNewChat();

  const allMessages = chat ? getAllMessages(chat) : [];
  const currentSession = chat ? getCurrentSession(chat) : null;
  const sessions: ChatSession[] = chat?.sessions && chat.sessions.length > 0
    ? chat.sessions
    : chat?.messages.length ? [{ id: "default", messages: chat.messages }] : [];

  async function handleSubmit(formData: FormData) {
    const userMessage = formData.get("message") as string;
    if (!userMessage?.trim()) return;

    formRef.current?.reset();

    // Intercept "compact" command
    if (userMessage.trim().toLowerCase() === "compact") {
      await handleCompact();
      return;
    }

    const userMessageId = crypto.randomUUID();
    const userMessageObj = {
      id: userMessageId,
      role: "user" as const,
      content: userMessage,
      createdAt: Date.now(),
    };

    const currentChat = chat || createNewChat();
    addMessageToChat(currentChat.id, userMessageObj);

    const currentMessages = currentSession?.messages || [];
    if (currentMessages.length === 0 && (!chat?.sessions || chat.sessions.length <= 1)) {
      fetchTitle(currentChat.id, userMessage);
    }

    setIsLoading(true);
    isStreaming.current = true;

    const assistantMessageId = crypto.randomUUID();
    const assistantMessageObj = {
      id: assistantMessageId,
      role: "assistant" as const,
      content: "",
      createdAt: Date.now(),
    };

    addMessageToChat(currentChat.id, assistantMessageObj);

    // Build LLM messages from current session only (+ summary from previous sessions)
    const sessionMessages = currentSession?.messages || [];
    const previousSummary = chat?.sessions
      ?.filter((s) => s.summary)
      .map((s) => s.summary)
      .join("\n\n");

    const systemContent = [
      "You are a helpful ai assistant." + context,
      previousSummary ? `\n\nPrevious conversation summary:\n${previousSummary}` : "",
    ].join("");

    setStreamStats(null);
    try {
      await streamCompletion({
        model: selectedModel,
        messages: [
          { role: "system", content: systemContent },
          ...sessionMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userMessage },
        ],
        update: (str) =>
          updateMessageInChat(currentChat.id, assistantMessageId, str),
        onStats: setStreamStats,
      });
    } catch (error) {
      console.error("Error reading stream:", error);
      updateMessageInChat(
        currentChat.id,
        assistantMessageId,
        "Sorry, I encountered an error while streaming the response."
      );
    } finally {
      isStreaming.current = false;
    }

    setIsLoading(false);
  }

  async function handleCompact() {
    if (!currentChatId) return;
    const currentChat = chat || createNewChat();
    const currentMessages = currentSession?.messages || [];

    if (currentMessages.length < 2) return;

    // Add the user "compact" message visibly
    const userMsgId = crypto.randomUUID();
    addMessageToChat(currentChat.id, {
      id: userMsgId,
      role: "user",
      content: "compact",
      createdAt: Date.now(),
    });

    // Add an empty assistant message to stream the summary into
    const summaryMsgId = crypto.randomUUID();
    addMessageToChat(currentChat.id, {
      id: summaryMsgId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    });

    setIsLoading(true);
    isStreaming.current = true;
    setStreamStats(null);

    let summary = "";
    try {
      await streamCompletion({
        model: selectedModel,
        messages: [
          {
            role: "system",
            content:
              "Summarize the following conversation concisely. Capture key topics, decisions, and context needed to continue. Format as a clear summary with key points. Start with '**Conversation Summary:**'",
          },
          {
            role: "user",
            content: currentMessages
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n\n"),
          },
        ],
        update: (str) => {
          summary = str;
          updateMessageInChat(currentChat.id, summaryMsgId, str);
        },
        onStats: setStreamStats,
      });
    } catch (error) {
      console.error("Error compacting:", error);
      updateMessageInChat(
        currentChat.id,
        summaryMsgId,
        "Sorry, I couldn't summarize the conversation."
      );
      setIsLoading(false);
      isStreaming.current = false;
      return;
    }

    isStreaming.current = false;
    setIsLoading(false);

    // Now compact — archives current session with summary, starts fresh
    compactChat(currentChatId, summary);
  }

  function handleClear() {
    if (!currentChatId) return;
    clearMessagesInChat(currentChatId);
    setStreamStats(null);
  }

  async function fetchTitle(chatId: string, initialMessage: string) {
    const title = await fetchCompletion({
      model: selectedModel,
      messages: [
        {
          role: "system",
          content:
            "you are a summarizer. Your task is to take the following prompt and sumamrize it for a chat sidebar in 4 words or less. Do not give any explanation just a MAXIMUM of 4 words.",
        },
        { role: "user", content: initialMessage },
      ],
    });

    updateChatTitle(chatId, title);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-smooth w-full"
      >
        <div className="space-y-6 p-4 md:p-8 w-full max-w-[1100px] mx-auto flex flex-col gap-4 items-start">
          {allMessages.length > 0 ? (
            <>
              {sessions.map((session, sessionIdx) => (
                <div key={session.id} className="w-full">
                  {sessionIdx > 0 && (
                    <div className="flex items-center gap-2 my-4 w-full">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground px-2 shrink-0">
                        {session.summary ? "compacted" : `session ${sessionIdx + 1}`}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  {session.messages.map((message) => (
                    <div key={message.id} className="flex gap-3 md:gap-4 items-start w-full mb-4">
                      <div
                        className={`w-8 h-8 rounded-full text-xs font-medium text-primary ${
                          message.role === "assistant" ? "bg-muted" : "bg-muted/70"
                        } flex items-center justify-center shrink-0`}
                      >
                        {message.role === "assistant" ? "AI" : "You"}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <MessageReasoning content={message.content} />
                        <MessageContent content={message.content} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <div className="text-primary flex gap-3 md:gap-4 items-start w-full">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary text-xs font-medium shrink-0">
                AI
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <MessageContent
                  content={parseMessageContent(DEFAULT_CHAT_MESSAGE).message}
                />
              </div>
            </div>
          )}
          {isLoading && !allMessages[allMessages.length - 1]?.content && (
            <div className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary text-xs font-medium shrink-0">
                AI
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm">Assistant</p>
                <div className="text-sm">...</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ChatStatsBar
        messages={allMessages}
        streamStats={streamStats}
        isStreaming={isStreaming.current}
        onClear={handleClear}
      />
      <UserInput
        formRef={formRef}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        hideSelector={hideSelector}
      />
    </div>
  );
}
