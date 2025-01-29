import { Chat } from "@/types/chat";
import { RefObject, useCallback, useLayoutEffect } from "react";

export default function useScrollToBottom({
  chatContainerRef,
  isStreaming,
  isScrolling,
  chat,
}: {
  chatContainerRef: RefObject<HTMLDivElement | null>;
  isStreaming: boolean;
  isScrolling: boolean;
  chat: Chat | undefined;
}) {
  const scrollToBottom = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const yOffset = container.scrollHeight - container.clientHeight;
    container.scrollTo({
      top: yOffset,
      behavior: isScrolling ? "auto" : "smooth",
    });
  }, [chatContainerRef, isScrolling]);

  const lastMessage = chat?.messages[chat.messages.length - 1]?.content;

  // Scroll to bottom when new messages arrive
  useLayoutEffect(() => {
    const shouldScroll = isStreaming;

    if (shouldScroll) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [isStreaming, lastMessage, chatContainerRef, scrollToBottom, isScrolling]);
}
