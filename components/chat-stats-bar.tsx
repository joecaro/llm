"use client";

import { Trash2, Zap, MessageSquare, Clock, Hash } from "lucide-react";
import { Button } from "./ui/button";
import type { StreamStats } from "@/fetches/completion";
import type { ChatMessage } from "@/types/chat";

interface ChatStatsBarProps {
  messages: ChatMessage[];
  streamStats: StreamStats | null;
  isStreaming: boolean;
  onClear: () => void;
}

function estimateTokens(messages: ChatMessage[]): number {
  const totalChars = messages.reduce((acc, m) => acc + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}

export function ChatStatsBar({
  messages,
  streamStats,
  isStreaming,
  onClear,
}: ChatStatsBarProps) {
  const contextTokens = estimateTokens(messages);
  const messageCount = messages.length;

  return (
    <div className="flex items-center gap-3 px-2 md:px-4 py-1 text-xs text-muted-foreground border-t border-border overflow-x-auto">
      <span className="flex items-center gap-1 shrink-0" title="Messages">
        <MessageSquare className="w-3 h-3" />
        {messageCount}
      </span>
      <span className="flex items-center gap-1 shrink-0" title="Estimated context tokens">
        <Hash className="w-3 h-3" />
        ~{contextTokens.toLocaleString()}t
      </span>
      {streamStats && (
        <>
          <span className="flex items-center gap-1 shrink-0" title="Tokens per second">
            <Zap className="w-3 h-3" />
            {streamStats.tokensPerSecond.toFixed(1)} t/s
          </span>
          <span className="flex items-center gap-1 shrink-0" title="Generation time">
            <Clock className="w-3 h-3" />
            {streamStats.elapsed.toFixed(1)}s
          </span>
          {streamStats.done && (
            <span className="shrink-0">
              {streamStats.totalTokens} tokens
            </span>
          )}
        </>
      )}
      {isStreaming && (
        <span className="shrink-0 text-primary animate-pulse">streaming...</span>
      )}
      <span className="flex-1" />
      {messageCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0"
          onClick={onClear}
          title="Clear conversation"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
