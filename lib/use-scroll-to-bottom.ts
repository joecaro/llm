import { Chat } from "@/types/chat";
import {
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";

export default function useScrollToBottom({
  chatContainerRef,
  isStreaming,
  chat,
}: {
  chatContainerRef: RefObject<HTMLDivElement | null>;
  isStreaming: boolean;
  chat: Chat | undefined;
}) {
  const isScrolling = useRef(false);
  const isAtBottom = useRef(true);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Helper to check if we're near bottom (within 100px or at bottom)
  const checkIfNearBottom = useCallback((): boolean => {
    const container = chatContainerRef.current;
    if (!container) return false;

    const threshold = 100; // px from bottom to trigger auto-scroll
    const scrollBottom = Math.abs(
      container.scrollHeight - container.clientHeight - container.scrollTop
    );
    return scrollBottom <= threshold;
  }, [chatContainerRef]);

  const scrollToBottom = useCallback(
    (force = false) => {
      const container = chatContainerRef.current;
      if (!container) return;

      // Only auto-scroll if we're already near bottom or forced
      if (!force && !isAtBottom.current) return;

      const yOffset = container.scrollHeight - container.clientHeight;

      // Use smooth scrolling only for user-initiated scrolls
      container.scrollTo({
        top: yOffset,
        behavior: isScrolling.current ? "auto" : "smooth",
      });
    },
    [chatContainerRef]
  );

  const lastMessage = chat?.messages[chat.messages.length - 1]?.content;

  // Handle scroll events and track position
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Clear existing timeout to prevent rapid updates
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      isScrolling.current = true;
      isAtBottom.current = checkIfNearBottom();

      // Reset scrolling state after a delay
      scrollTimeout.current = setTimeout(() => {
        isScrolling.current = false;
      }, 150);
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      container.removeEventListener("scroll", handleScroll);
    };
  }, [chatContainerRef, checkIfNearBottom]);

  // Handle auto-scrolling for new messages and streaming
  useLayoutEffect(() => {
    if (lastMessage) {
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [isStreaming, lastMessage, scrollToBottom]);

  return { scrollToBottom };
}
