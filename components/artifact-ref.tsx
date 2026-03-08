"use client";

import { FileCode2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat-store";
import { isArtifactPreviewable } from "@/utils/artifact-apply";

interface ArtifactRefProps {
  path: string;
}

export function ArtifactRef({ path }: ArtifactRefProps) {
  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const setArtifactPanelOpen = useChatStore.use.setArtifactPanelOpen();
  const setActiveArtifactPath = useChatStore.use.setActiveArtifactPath();
  const setArtifactView = useChatStore.use.setArtifactView();

  const currentChat = chats.find((chat) => chat.id === currentChatId);
  const artifact = currentChat?.artifacts.files[path];

  const handleOpen = () => {
    if (!artifact) return;

    setActiveArtifactPath(path);
    setArtifactView(isArtifactPreviewable(artifact.language) ? "preview" : "code");
    setArtifactPanelOpen(true);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="inline-flex h-auto min-h-8 items-center gap-2 rounded-full px-3 py-1 align-middle"
      onClick={handleOpen}
      disabled={!artifact}
    >
      {artifact ? (
        <FileCode2 className="h-4 w-4" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
      <span className="max-w-[220px] truncate">{path}</span>
    </Button>
  );
}
