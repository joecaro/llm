"use client";

import { sendMessage } from "@/app/actions";
import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { MessageContent } from "./message-content";
import { MessageReasoning } from "./message-reasoning";
import { parseMessageContent } from "@/utils/message-parser";
import { Chat, ChatMessage, saveChat } from "@/utils/chat-storage";
import UserInput from "./user-input";
import { ModelId } from "./model-selector";
import { DEFAULT_CHAT_MESSAGE } from "@/utils/constants";

export function MessagesSection({ chat }: { chat: Chat | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (chat?.messages && chat.messages.length > 0) {
      return chat.messages;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentStreamedContent, setCurrentStreamedContent] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelId>("llama3.2");
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Add effect to update messages when chat changes
  useEffect(() => {
    if (chat?.messages) {
      setMessages(chat.messages);
    }
  }, [chat]);

  // Add effect to save messages whenever they change
  useEffect(() => {
    if (chat?.id) {
      saveChat({
        ...chat,
        messages,
      });
    }
    console.log("messages", messages);
  }, [messages, chat?.id, chat]);

  // Handle scroll events to track if we're at the bottom
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Consider "at bottom" if within 100px of the bottom
      const isBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(isBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to bottom only if we were already at the bottom
  useLayoutEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, currentStreamedContent, isAtBottom]);

  async function handleSubmit(formData: FormData) {
    const userMessage = formData.get("message") as string;
    if (!userMessage?.trim()) return;
    
    setIsLoading(true);
    formRef.current?.reset();

    // Create a unique ID for the user message
    const userMessageId = crypto.randomUUID();

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: "user",
        content: userMessage,
        createdAt: Date.now(),
      },
    ]);

    // Ensure messages are updated before continuing
    await new Promise(resolve => setTimeout(resolve, 0));

    // Pass the selected model to the server action
    const result = await sendMessage(formData, selectedModel);

    if (result.success && result.url) {
      try {
        const response = await fetch(result.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(result.payload),
        });

        if (!response.ok) {
          throw new Error("Failed to get completion");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let streamedContent = "";

        // Add an empty assistant message that will be updated with streamed content
        const assistantMessageId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            createdAt: Date.now(),
          },
        ]);

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
                  // Update the last message with the current streamed content
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      id: assistantMessageId,
                      role: "assistant",
                      content: streamedContent,
                      createdAt: Date.now(),
                    };
                    return newMessages;
                  });
                }
              } catch (e) {
                console.error("Error parsing JSON:", e);
              }
            }
          }

          // Remove the currentStreamedContent state since we're updating messages directly
          setCurrentStreamedContent("");
        }
      } catch (error) {
        console.error("Error reading stream:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: userMessageId,
            role: "assistant",
            content:
              "Sorry, I encountered an error while streaming the response.",
            createdAt: Date.now(),
          },
        ]);
      }
    } else if (result.error) {
      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          createdAt: Date.now(),
        },
      ]);
    }

    setIsLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto">
          <div className="space-y-6 p-8">
            {messages.length > 0 ? (
              messages.map((message, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div
                    className={`w-8 h-8 rounded-full ${
                      message.role === "assistant"
                        ? "bg-white/10"
                        : "bg-white/20"
                    } flex items-center justify-center text-white/90 shrink-0`}
                  >
                    {message.role === "assistant" ? "AI" : "You"}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-white/70">
                      {message.role === "assistant" ? "Assistant" : "You"}
                    </p>
                    <div className="text-white/90">
                      <MessageReasoning content={message.content} />
                      <MessageContent
                        content={parseMessageContent(message.content).message}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 shrink-0">
                  AI
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-white/70">Assistant</p>
                  <div className="text-white/90">
                    <MessageContent
                      content={
                        parseMessageContent(DEFAULT_CHAT_MESSAGE).message
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {isLoading && !messages[messages.length - 1]?.content && (
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 shrink-0">
                  AI
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-white/70">Assistant</p>
                  <div className="text-white/90">
                    <div className="animate-pulse">●●●</div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <UserInput
        formRef={formRef}
        messages={messages}
        handleSubmit={handleSubmit}
        setSelectedModel={setSelectedModel}
        isLoading={isLoading}
      />
    </div>
  );
}
