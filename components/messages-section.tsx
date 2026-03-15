"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, RotateCcw, X } from "lucide-react";
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
import { runHarnessAwareTurn, type HarnessLoopStatus } from "@/lib/harness-orchestrator";
import { isArtifactPreviewable } from "@/utils/artifact-apply";
import type { ChatMessage, ChatSession } from "@/types/chat";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const ARTIFACT_PREFERRED_INTENT_RE =
  /\b(components?|widgets?|ui|page|pages|app|apps|screen|screens|layout|layouts|card|cards|form|forms|table|tables|modal|modals|dialog|dialogs|button|buttons|navbar|navbars|todo|dashboard|dashboards|react|tsx|jsx|css)\b/i;
const SMALL_SNIPPET_RE =
  /\b(snippet|small snippet|tiny snippet|quick snippet|one-liner|one liner|short example)\b/i;

function buildArtifactPreferenceHint(userMessage: string, hasArtifacts: boolean) {
  if (SMALL_SNIPPET_RE.test(userMessage)) {
    return "";
  }

  if (hasArtifacts || ARTIFACT_PREFERRED_INTENT_RE.test(userMessage)) {
    return [
      "For this request, prefer the artifact filesystem for any non-trivial component or reusable UI output.",
      "Use bare code fences only for very small snippets or quick examples.",
    ].join("\n");
  }

  return "";
}

function findMessageLocation(
  sessions: ChatSession[],
  messageId: string
): { sessionIndex: number; messageIndex: number } | null {
  for (const [sessionIndex, session] of sessions.entries()) {
    const messageIndex = session.messages.findIndex(
      (message) => message.id === messageId
    );

    if (messageIndex !== -1) {
      return { sessionIndex, messageIndex };
    }
  }

  return null;
}

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
  const [selectedModel, setSelectedModel] = useState<ModelId>("bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q5_K_M");
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [artifactStatus, setArtifactStatus] = useState<HarnessLoopStatus | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const addMessageToChat = useChatStore.use.addMessageToChat();
  const updateMessageInChat = useChatStore.use.updateMessageInChat();
  const replaceMessageAndTruncateChat =
    useChatStore.use.replaceMessageAndTruncateChat();
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

  useEffect(() => {
    setEditingMessageId(null);
    setEditingContent("");
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
    const artifactPreferenceHint = buildArtifactPreferenceHint(
      userMessage,
      currentChat.artifacts.order.length > 0
    );
    const systemContent = [
      "You are a helpful ai assistant." + context,
      previousSummary ? `\n\nPrevious conversation summary:\n${previousSummary}` : "",
      artifactPreferenceHint ? `\n\n${artifactPreferenceHint}` : "",
    ].join("");

    setIsLoading(true);
    isStreaming.current = true;
    setStreamStats(null);
    setArtifactStatus({
      pass: 1,
      phase: "thinking",
      message: "Thinking (1/6)",
    });

    addMessageToChat(currentChat.id, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    });

    try {
      const result = await runHarnessAwareTurn({
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

      console.error("Error running harness-aware turn:", error);

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

  function handleEditStart(message: ChatMessage) {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  }

  function handleEditCancel() {
    setEditingMessageId(null);
    setEditingContent("");
  }

  async function handleEditRestart(messageId: string) {
    if (!chat) return;

    const nextContent = editingContent.trim();
    if (!nextContent) return;

    const location = findMessageLocation(sessions, messageId);
    if (!location) return;

    const targetSession = sessions[location.sessionIndex];
    const priorSessionMessages = targetSession.messages.slice(0, location.messageIndex);
    const previousSummary = sessions
      .slice(0, location.sessionIndex)
      .map((session) => session.summary)
      .filter((summary): summary is string => Boolean(summary))
      .join("\n\n");
    const shouldRefreshTitle =
      location.sessionIndex === 0 && location.messageIndex === 0;

    currentChatIdRef.current = chat.id;
    replaceMessageAndTruncateChat(chat.id, messageId, nextContent);
    handleEditCancel();

    if (shouldRefreshTitle) {
      fetchTitle(chat.id, nextContent);
    }

    const refreshedChat = useChatStore
      .getState()
      .chats.find((candidate) => candidate.id === chat.id);

    if (!refreshedChat) return;

    const assistantMessageId = crypto.randomUUID();
    const artifactPreferenceHint = buildArtifactPreferenceHint(
      nextContent,
      refreshedChat.artifacts.order.length > 0
    );
    const systemContent = [
      "You are a helpful ai assistant." + context,
      previousSummary ? `\n\nPrevious conversation summary:\n${previousSummary}` : "",
      artifactPreferenceHint ? `\n\n${artifactPreferenceHint}` : "",
    ].join("");

    setIsLoading(true);
    isStreaming.current = true;
    setStreamStats(null);
    setArtifactStatus({
      pass: 1,
      phase: "thinking",
      message: "Thinking (1/6)",
    });

    addMessageToChat(chat.id, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    });

    try {
      const result = await runHarnessAwareTurn({
        model: selectedModel,
        systemContent,
        sessionMessages: priorSessionMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        userMessage: nextContent,
        artifacts: refreshedChat.artifacts,
        assistantMessageId,
        onStatus: setArtifactStatus,
        onStats: setStreamStats,
        onVisibleContent: (content) => {
          if (currentChatIdRef.current !== chat.id) return;
          updateMessageInChat(chat.id, assistantMessageId, content);
        },
        isCancelled: () => currentChatIdRef.current !== chat.id,
      });

      if (currentChatIdRef.current !== chat.id) {
        return;
      }

      updateMessageInChat(chat.id, assistantMessageId, result.content);

      if (result.changedPaths.length > 0) {
        setChatArtifacts(chat.id, result.artifacts);

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
      if (error instanceof Error && error.message === "cancelled") {
        return;
      }

      console.error("Error restarting from edited message:", error);

      if (currentChatIdRef.current === chat.id) {
        updateMessageInChat(
          chat.id,
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
                  {session.messages.map((message) => {
                    const isAssistant = message.role === "assistant";

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 md:gap-4 items-start w-full mb-4 ${
                          isAssistant ? "justify-start" : "justify-end"
                        }`}
                      >
                        {isAssistant && (
                          <div className="w-8 h-8 rounded-full text-xs font-medium text-primary bg-muted flex items-center justify-center shrink-0">
                            AI
                          </div>
                        )}
                        <div
                          className={`min-w-0 space-y-2 ${
                            isAssistant
                              ? "flex-1"
                              : "w-full sm:w-fit sm:min-w-[50%] sm:max-w-[70%]"
                          }`}
                        >
                          {editingMessageId === message.id ? (
                            <div className="border p-3 text-primary border-border bg-muted/50 rounded-lg shadow overflow-hidden space-y-3">
                              <Textarea
                                value={editingContent}
                                onChange={(event) => setEditingContent(event.target.value)}
                                disabled={isLoading}
                                className="min-h-[120px] resize-y bg-background/80"
                                onKeyDown={(event) => {
                                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                                    event.preventDefault();
                                    void handleEditRestart(message.id);
                                  }

                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    handleEditCancel();
                                  }
                                }}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleEditCancel}
                                  disabled={isLoading}
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void handleEditRestart(message.id)}
                                  disabled={isLoading || !editingContent.trim()}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                  Save and restart
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <MessageReasoning content={message.content} />
                              <MessageContent
                                content={message.content}
                                chatId={chat?.id}
                                messageId={message.id}
                              />
                            </>
                          )}
                          {!isAssistant && editingMessageId !== message.id && (
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => handleEditStart(message)}
                                disabled={isLoading}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </Button>
                            </div>
                          )}
                        </div>
                        {!isAssistant && (
                          <div className="w-8 h-8 rounded-full text-xs font-medium text-primary bg-muted/70 flex items-center justify-center shrink-0">
                            You
                          </div>
                        )}
                      </div>
                    );
                  })}
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
