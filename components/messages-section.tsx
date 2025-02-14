"use client";

import { sendMessage } from "@/app/actions";
import { useRef, useState } from "react";
import { MessageContent } from "./message-content";
import { MessageReasoning } from "./message-reasoning";
import { parseMessageContent } from "@/utils/message-parser";
import UserInput from "./user-input";
import { ModelId } from "./model-selector";
import { DEFAULT_CHAT_MESSAGE } from "@/utils/constants";
import { useChatStore } from "@/store/chat-store";
import useScrollToBottom from "@/lib/use-scroll-to-bottom";

export function MessagesSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("llama3.2");
  const isStreaming = useRef(false);

  const currentChatId = useChatStore.use.currentChatId();
  const addMessageToChat = useChatStore.use.addMessageToChat();
  const updateMessageInChat = useChatStore.use.updateMessageInChat();
  const chat = useChatStore.use.chats().find((c) => c.id === currentChatId);

  useScrollToBottom({
    chatContainerRef,
    isStreaming: isStreaming.current,
    chat,
  });

  const createNewChatFromMessage = useChatStore.use.createNewChatFromMessage();

  async function handleSubmit(formData: FormData) {
    const userMessage = formData.get("message") as string;
    if (!userMessage?.trim()) return;

    const userMessageId = crypto.randomUUID();
    const userMessageObj = {
      id: userMessageId,
      role: "user" as const,
      content: userMessage,
      createdAt: Date.now(),
    };

    if (chat) {
      addMessageToChat(chat.id, userMessageObj);
    }
    const currentChat = chat || createNewChatFromMessage(userMessageObj);

    setIsLoading(true);
    isStreaming.current = true;
    formRef.current?.reset();

    const assistantMessageId = crypto.randomUUID();
    const assistantMessageObj = {
      id: assistantMessageId,
      role: "assistant" as const,
      content: "",
      createdAt: Date.now(),
    };

    addMessageToChat(currentChat.id, assistantMessageObj);

    try {
      const response = await fetch(
        "http://127.0.0.1:11434/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { role: "system", content: "You are a helpful ai assistant." },
              ...(chat?.messages || []),
              { role: "user", content: userMessage },
            ],
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get completion");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              if (line === "data: [DONE]") continue;

              const jsonString = line.replace(/^data: /, "");
              const json = JSON.parse(jsonString);

              if (json.choices?.[0]?.delta?.content) {
                streamedContent += json.choices[0].delta.content;
                updateMessageInChat(
                  currentChat.id,
                  assistantMessageId,
                  streamedContent
                );
              }
            } catch (e) {
              console.error("Error parsing JSON:", e);
            }
          }
        }
      }
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

  return (
    <div className="flex flex-col h-full">
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="mx-auto">
          <div className="space-y-6 p-8">
            {chat?.messages && chat.messages.length > 0 ? (
              chat.messages.map((message) => (
                <div key={message.id} className="flex gap-4 items-start">
                  <div
                    className={`w-8 h-8 rounded-full text-primary ${
                      message.role === "assistant"
                        ? "bg-white/10"
                        : "bg-white/20"
                    } flex items-center justify-center shrink-0`}
                  >
                    {message.role === "assistant" ? "AI" : "You"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-primary">
                      {message.role === "assistant" ? "Assistant" : "You"}
                    </p>
                    <div>
                      <MessageReasoning content={message.content} />
                      <MessageContent
                        content={parseMessageContent(message.content).message}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-primary flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 shrink-0">
                  AI
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm">Assistant</p>
                  <div>
                    <MessageContent
                      content={
                        parseMessageContent(DEFAULT_CHAT_MESSAGE).message
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            {isLoading &&
              !chat?.messages[chat.messages.length - 1]?.content && (
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 shrink-0">
                    AI
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm">Assistant</p>
                    <div className="text-sm">●●●</div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
      <UserInput
        formRef={formRef}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />
    </div>
  );
}
