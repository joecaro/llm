"use client";

import { sendMessage } from "@/app/actions";
import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { MessageContent } from "./message-content";
import { MessageReasoning } from "./message-reasoning";
import { parseMessageContent } from "@/utils/message-parser";
import UserInput from "./user-input";
import { ModelId } from "./model-selector";
import { DEFAULT_CHAT_MESSAGE } from "@/utils/constants";
import { useChatStore } from "@/store/chat-store";
import { motion, AnimatePresence } from "framer-motion";

export function MessagesSection() {
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("llama3.2");
  const [isAtBottom, setIsAtBottom] = useState(true);

  const currentChatId = useChatStore.use.currentChatId();
  const addMessageToChat = useChatStore.use.addMessageToChat();
  const updateMessageInChat = useChatStore.use.updateMessageInChat();
  const chat = useChatStore.use.chats().find((c) => c.id === currentChatId);

  const createNewChatFromMessage = useChatStore.use.createNewChatFromMessage();

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
    if (isAtBottom && chat?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.messages, isAtBottom]);

  async function handleSubmit(formData: FormData) {
    const userMessage = formData.get("message") as string;

    const currentChat =
      chat ||
      createNewChatFromMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        createdAt: Date.now(),
      });
    if (!userMessage?.trim()) return;

    setIsLoading(true);
    formRef.current?.reset();

    // Create a unique ID for the user message
    const userMessageId = crypto.randomUUID();
    const userMessageObj = {
      id: userMessageId,
      role: "user" as const,
      content: userMessage,
      createdAt: Date.now(),
    };

    // Add user message
    addMessageToChat(currentChat.id, userMessageObj);

    // Pass the selected model to the server action
    const result = await sendMessage(formData, selectedModel);

    // Add an empty assistant message that will be updated with streamed content
    const assistantMessageId = crypto.randomUUID();
    const assistantMessageObj = {
      id: assistantMessageId,
      role: "assistant" as const,
      content: "",
      createdAt: Date.now(),
    };

    addMessageToChat(currentChat.id, assistantMessageObj);

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
      }
    } else if (result.error) {
      updateMessageInChat(
        currentChat.id,
        assistantMessageId,
        "Sorry, I encountered an error. Please try again."
      );
    }

    setIsLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      <motion.div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto"
        layout
      >
        <motion.div className="mx-auto" layout>
          <motion.div className="space-y-6 p-8" layout>
            <AnimatePresence mode="popLayout">
              {chat?.messages && chat.messages.length > 0 ? (
                chat.messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{
                      duration: 0.4,
                      ease: "easeOut",
                      delay: index === chat.messages.length - 1 ? 0 : 0,
                    }}
                    className="flex gap-4 items-start"
                  >
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className={`w-8 h-8 rounded-full text-primary ${
                        message.role === "assistant"
                          ? "bg-white/10"
                          : "bg-white/20"
                      } flex items-center justify-center shrink-0`}
                    >
                      {message.role === "assistant" ? "AI" : "You"}
                    </motion.div>
                    <motion.div
                      layout
                      className="flex-1 space-y-2"
                    >
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-primary"
                      >
                        {message.role === "assistant" ? "Assistant" : "You"}
                      </motion.p>
                      <div>
                        <MessageReasoning content={message.content} />
                        <MessageContent
                          content={parseMessageContent(message.content).message}
                        />
                      </div>
                    </motion.div>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-primary flex gap-4 items-start"
                >
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 shrink-0"
                  >
                    AI
                  </motion.div>
                  <motion.div className="flex-1 space-y-2">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm"
                    >
                      Assistant
                    </motion.p>
                    <div>
                      <MessageContent
                        content={parseMessageContent(DEFAULT_CHAT_MESSAGE).message}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}
              {isLoading && !chat?.messages[chat.messages.length - 1]?.content && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex gap-4 items-start"
                >
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90 shrink-0"
                  >
                    AI
                  </motion.div>
                  <motion.div className="flex-1 space-y-2">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm"
                    >
                      Assistant
                    </motion.p>
                    <div>
                      <motion.div
                        animate={{
                          opacity: [0.3, 1, 0.3],
                          transition: { repeat: Infinity, duration: 1.5 }
                        }}
                        className="text-sm"
                      >
                        ●●●
                      </motion.div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </motion.div>
        </motion.div>
      </motion.div>
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
