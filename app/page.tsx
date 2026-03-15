"use client";

import { MessagesSection } from "@/components/messages-section";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ArtifactPanel } from "@/components/artifact-panel";
import { useChatStore } from "@/store/chat-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Chat } from "@/types/chat";

const DEFAULT_PANEL_WIDTH = 700;
const MIN_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 1200;

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [diskSyncEnabled, setDiskSyncEnabled] = useState(false);
  const isResizing = useRef(false);
  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const artifactPanelOpen = useChatStore.use.artifactPanelOpen();
  const setArtifactPanelOpen = useChatStore.use.setArtifactPanelOpen();
  const storageHydrated = useChatStore.use.storageHydrated();
  const hydrateFromDisk = useChatStore.use.hydrateFromDisk();
  const markStorageHydrated = useChatStore.use.markStorageHydrated();

  const syncPayload = JSON.stringify({
    chats,
    currentChatId,
  });

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - e.clientX;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + delta));
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [panelWidth]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      try {
        const response = await fetch("/api/conversations", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load conversations from disk.");
        }

        const data = (await response.json()) as {
          chats?: unknown;
          currentChatId?: unknown;
        };

        if (cancelled) {
          return;
        }

        hydrateFromDisk({
          chats: Array.isArray(data.chats) ? (data.chats as Chat[]) : [],
          currentChatId:
            typeof data.currentChatId === "string" ? data.currentChatId : null,
        });
        setDiskSyncEnabled(true);
      } catch (error) {
        console.error("Failed to hydrate conversations from disk:", error);

        if (!cancelled) {
          markStorageHydrated();
        }
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [hydrateFromDisk, markStorageHydrated]);

  useEffect(() => {
    if (!storageHydrated || !diskSyncEnabled) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetch("/api/conversations", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: syncPayload,
        signal: controller.signal,
      }).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Failed to persist conversations to disk:", error);
      });
    }, 800);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [diskSyncEnabled, storageHydrated, syncPayload]);

  return (
    <main className="h-screen w-screen bg-background flex relative overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {artifactPanelOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setArtifactPanelOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 h-full transform transition-transform duration-200 md:relative md:translate-x-0 md:shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <ChatSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 h-screen flex flex-col min-w-0 min-h-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center p-2 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        <MessagesSection />
      </div>

      <div
        className={`fixed inset-y-0 right-0 z-40 h-full w-full transform transition-transform duration-200 md:relative md:max-w-none ${
          artifactPanelOpen
            ? "translate-x-0 md:shrink-0"
            : "translate-x-full md:w-0 md:translate-x-0"
        }`}
        style={artifactPanelOpen ? { width: panelWidth, maxWidth: "90vw" } : undefined}
      >
        <div
          className={`h-full transition-opacity duration-200 ${
            artifactPanelOpen
              ? "opacity-100"
              : "pointer-events-none opacity-0 md:opacity-0"
          }`}
        >
          {/* Resize handle */}
          <div
            className="absolute inset-y-0 left-0 z-50 hidden w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-primary/20 md:block"
            onMouseDown={startResize}
          />
          <ArtifactPanel />
        </div>
      </div>
    </main>
  );
}
