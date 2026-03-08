"use client";

import { useEffect, useRef, useState } from "react";
import { MessageContent } from "./message-content";
import { MessageReasoning } from "./message-reasoning";
import { ArtifactStatusRow } from "./artifact-status-row";
import { parseMessageContent } from "@/utils/message-parser";
import UserInput from "./user-input";
import { ModelId } from "./model-selector";
import { DEFAULT_CHAT_MESSAGE } from "@/utils/constants";
import { getAllMessages, getCurrentSession, useChatStore } from "@/store/chat-store";
import useScrollToBottom from "@/lib/use-scroll-to-bottom";
import { fetchCompletion, streamCompletion, type StreamStats } from "@/fetches/completion";
import { ChatStatsBar } from "./chat-stats-bar";
import { runArtifactAwareTurn, type ArtifactLoopStatus } from "@/lib/artifact-orchestrator";
import { isArtifactPreviewable } from "@/utils/artifact-apply";
import type { ChatMessage, ChatSession } from "@/types/chat";

export function MessagesSection({
  hideSelector = false,
  context = "",
}: {
  hideSelector?: boolean;
  context?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const isStreaming = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("qwen2.5:7b");
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [artifactStatus, setArtifactStatus] = useState<ArtifactLoopStatus | null>(null);

  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const addMessageToChat = useChatStore.use.addMessageToChat();
  const updateMessageInChat = useChatStore.use.updateMessageInChat();
  const updateChatTitle = useChatStore.use.updateChatTitle();
  const compactChat = useChatStore.use.compactChat();
  const clearMessagesInChat = useChatStore.use.clearMessagesInChat();
  const createNewChat = useChatStore.use.createNewChat();
  const setChatArtifacts = useChatStore.use.setChatArtifacts();
  const setArtifactPanelOpen = useChatStore.use.setArtifactPanelOpen();
  const setActiveArtifactPath = useChatStore.use.setActiveArtifactPath();
  const setArtifactView = useChatStore.use.setArtifactView();

  const chat = chats.find((candidate) => candidate.id === currentChatId);

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  useScrollToBottom({
    chatContainerRef,
    isStreaming: isStreaming.current,
    chat,
  });

  const allMessages = chat ? getAllMessages(chat) : [];
  const currentSession = chat ? getCurrentSession(chat) : null;
  const sessions: ChatSession[] =
    chat?.sessions && chat.sessions.length > 0
      ? chat.sessions
      : chat?.messages.length
        ? [{ id: "default", messages: chat.messages }]
        : [];

  async function handleSubmit(formData: FormData) {
    const userMessage = formData.get("message") as string;
    if (!userMessage?.trim()) return;

    formRef.current?.reset();

    if (userMessage.trim().toLowerCase() === "compact") {
      await handleCompact();
      return;
    }

    const currentChat = chat ?? createNewChat();
    currentChatIdRef.current = currentChat.id;
    const currentMessages = currentSession?.messages ?? [];
    const userMessageObj: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      createdAt: Date.now(),
    };

    addMessageToChat(currentChat.id, userMessageObj);

    if (currentMessages.length === 0 && (!chat?.sessions || chat.sessions.length <= 1)) {
      fetchTitle(currentChat.id, userMessage);
    }

    const assistantMessageId = crypto.randomUUID();
    const previousSummary = chat?.sessions
      ?.filter((session) => session.summary)
      .map((session) => session.summary)
      .join("\n\n");
    const systemContent = [
      "You are a helpful ai assistant." + context,
      previousSummary ? `\n\nPrevious conversation summary:\n${previousSummary}` : "",
    ].join("");

    setIsLoading(true);
    isStreaming.current = true;
    setStreamStats(null);
    setArtifactStatus({
      pass: 1,
      phase: "thinking",
      message: "Thinking (1/4)",
    });

    addMessageToChat(currentChat.id, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    });

    try {
      const result = await runArtifactAwareTurn({
        model: selectedModel,
        systemContent,
        sessionMessages: currentMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        userMessage,
        artifacts: currentChat.artifacts,
        assistantMessageId,
        onStatus: setArtifactStatus,
        onStats: setStreamStats,
        onVisibleContent: (content) => {
          if (currentChatIdRef.current !== currentChat.id) return;
          updateMessageInChat(currentChat.id, assistantMessageId, content);
        },
        isCancelled: () => currentChatIdRef.current !== currentChat.id,
      });

      if (currentChatIdRef.current !== currentChat.id) {
        return;
      }

      updateMessageInChat(currentChat.id, assistantMessageId, result.content);

      if (result.changedPaths.length > 0) {
        setChatArtifacts(currentChat.id, result.artifacts);

        const lastChangedPath =
          result.changedPaths[result.changedPaths.length - 1] ?? null;

        if (lastChangedPath) {
          const artifact = result.artifacts.files[lastChangedPath];
          setActiveArtifactPath(lastChangedPath);
          setArtifactView(
            artifact && isArtifactPreviewable(artifact.language) ? "preview" : "code"
          );
          setArtifactPanelOpen(true);
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "cancelled"
      ) {
        return;
      }

      console.error("Error running artifact-aware turn:", error);

      if (currentChatIdRef.current === currentChat.id) {
        updateMessageInChat(
          currentChat.id,
          assistantMessageId,
          "Sorry, I encountered an error while generating the response."
        );
      }
    } finally {
      isStreaming.current = false;
      setArtifactStatus(null);
      setIsLoading(false);
    }
  }

  async function handleCompact() {
    if (!currentChatId) return;

    const currentChat = chat ?? createNewChat();
    currentChatIdRef.current = currentChat.id;
    const currentMessages = currentSession?.messages ?? [];

    if (currentMessages.length < 2) return;

    const userMsgId = crypto.randomUUID();
    addMessageToChat(currentChat.id, {
      id: userMsgId,
      role: "user",
      content: "compact",
      createdAt: Date.now(),
    });

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
              .map((message) => `${message.role}: ${message.content}`)
              .join("\n\n"),
          },
        ],
        update: (content) => {
          summary = content;
          updateMessageInChat(currentChat.id, summaryMsgId, content);
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
                    <div
                      key={message.id}
                      className="flex gap-3 md:gap-4 items-start w-full mb-4"
                    >
                      <div
                        className={`w-8 h-8 rounded-full text-xs font-medium text-primary ${
                          message.role === "assistant" ? "bg-muted" : "bg-muted/70"
                        } flex items-center justify-center shrink-0`}
                      >
                        {message.role === "assistant" ? "AI" : "You"}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <MessageReasoning content={message.content} />
                        <MessageContent
                          content={message.content}
                          chatId={chat?.id}
                          messageId={message.id}
                        />
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

          {artifactStatus && (
            <div className="flex gap-3 md:gap-4 items-start w-full">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-primary text-xs font-medium shrink-0">
                AI
              </div>
              <div className="flex-1 min-w-0">
                <ArtifactStatusRow status={artifactStatus} />
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
