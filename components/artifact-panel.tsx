"use client";

import { useEffect, useRef, useState } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import { Check, Code2, Copy, Eye, FileCode2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore } from "@/store/chat-store";
import { getArtifactCssBundle, isArtifactPreviewable } from "@/utils/artifact-apply";
import { ReactComponentPreview } from "@/components/react-component-preview";
import { cn } from "@/lib/utils";

function buildHtmlPreviewDocument(html: string, cssBundle: string): string {
  const styleTag = cssBundle ? `<style>${cssBundle.replace(/<\/style>/gi, "<\\/style>")}</style>` : "";

  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}</head>`);
  }

  if (html.includes("<body")) {
    return `${styleTag}${html}`;
  }

  return `<!DOCTYPE html><html><head>${styleTag}</head><body>${html}</body></html>`;
}

function getPrismLanguage(language: string): string {
  switch (language) {
    case "html":
      return "markup";
    case "md":
      return "markdown";
    case "csv":
      return "none";
    case "text":
      return "none";
    default:
      return language;
  }
}

export function ArtifactPanel() {
  const codeRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const chats = useChatStore.use.chats();
  const currentChatId = useChatStore.use.currentChatId();
  const artifactPanelOpen = useChatStore.use.artifactPanelOpen();
  const activeArtifactPath = useChatStore.use.activeArtifactPath();
  const artifactView = useChatStore.use.artifactView();
  const setArtifactPanelOpen = useChatStore.use.setArtifactPanelOpen();
  const setActiveArtifactPath = useChatStore.use.setActiveArtifactPath();
  const setArtifactView = useChatStore.use.setArtifactView();

  const currentChat = chats.find((chat) => chat.id === currentChatId);
  const artifacts = currentChat?.artifacts;
  const activeArtifact =
    activeArtifactPath && artifacts?.files[activeArtifactPath]
      ? artifacts.files[activeArtifactPath]
      : null;
  const cssBundle = artifacts ? getArtifactCssBundle(artifacts) : "";
  const filteredPaths = artifacts
    ? artifacts.order.filter((path) =>
        path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  useEffect(() => {
    if (!artifacts || artifacts.order.length === 0) {
      if (artifactPanelOpen) {
        setArtifactPanelOpen(false);
      }
      if (activeArtifactPath) {
        setActiveArtifactPath(null);
      }
      return;
    }

    if (!activeArtifactPath || !artifacts.files[activeArtifactPath]) {
      const nextPath = artifacts.order[0] ?? null;
      setActiveArtifactPath(nextPath);

      if (nextPath) {
        const nextArtifact = artifacts.files[nextPath];
        setArtifactView(
          nextArtifact && isArtifactPreviewable(nextArtifact.language)
            ? "preview"
            : "code"
        );
      }
    }
  }, [
    activeArtifactPath,
    artifactPanelOpen,
    artifacts,
    setActiveArtifactPath,
    setArtifactPanelOpen,
    setArtifactView,
  ]);

  useEffect(() => {
    if (artifactView === "code" && codeRef.current) {
      Prism.highlightAllUnder(codeRef.current, true);
    }
  }, [artifactView, activeArtifact]);

  const handleSelectArtifact = (path: string) => {
    if (!artifacts) return;

    const artifact = artifacts.files[path];
    if (!artifact) return;

    setActiveArtifactPath(path);
    setArtifactView(isArtifactPreviewable(artifact.language) ? "preview" : "code");
    setArtifactPanelOpen(true);
  };

  const handleCopy = async () => {
    if (!activeArtifact) return;

    await navigator.clipboard.writeText(activeArtifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Artifacts
          </p>
          <p className="truncate text-sm font-medium text-primary">
            {activeArtifact?.path ?? "No file selected"}
          </p>
        </div>

        {activeArtifact && (
          <>
            <Button
              type="button"
              variant={artifactView === "code" ? "default" : "outline"}
              size="sm"
              className="h-8 px-2"
              onClick={() => setArtifactView("code")}
            >
              <Code2 className="h-4 w-4" />
              <span className="sr-only">Code view</span>
            </Button>

            {isArtifactPreviewable(activeArtifact.language) && (
              <Button
                type="button"
                variant={artifactView === "preview" ? "default" : "outline"}
                size="sm"
                className="h-8 px-2"
                onClick={() => setArtifactView("preview")}
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">Preview view</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">Copy file</span>
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setArtifactPanelOpen(false)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close artifacts panel</span>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/20">
          <div className="border-b border-border p-3">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search files..."
              className="h-9"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredPaths.length > 0 ? (
              <div className="space-y-1">
                {filteredPaths.map((path) => {
                  const artifact = artifacts?.files[path];

                  return (
                    <button
                      key={path}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted",
                        activeArtifact?.path === path && "bg-muted text-primary"
                      )}
                      onClick={() => handleSelectArtifact(path)}
                    >
                      <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{path}</div>
                        {artifact && (
                          <div className="text-xs text-muted-foreground">
                            {artifact.language}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-2 text-sm text-muted-foreground">
                {artifacts?.order.length ? "No files match that search." : "No artifacts yet."}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          {activeArtifact ? (
            artifactView === "preview" && isArtifactPreviewable(activeArtifact.language) ? (
              activeArtifact.language === "html" ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <iframe
                    title={activeArtifact.path}
                    srcDoc={buildHtmlPreviewDocument(activeArtifact.content, cssBundle)}
                    className="min-h-[520px] w-full border-none"
                    sandbox="allow-scripts"
                  />
                </div>
              ) : (
                <ReactComponentPreview
                  code={activeArtifact.content}
                  externalCss={cssBundle}
                  showChrome={false}
                  defaultPreviewVisible
                  title={activeArtifact.path}
                />
              )
            ) : (
              <div
                ref={codeRef}
                className="overflow-hidden rounded-lg border border-border bg-muted/40"
              >
                <pre className="overflow-x-auto p-4 text-sm">
                  <code className={`language-${getPrismLanguage(activeArtifact.language)}`}>
                    {activeArtifact.content}
                  </code>
                </pre>
              </div>
            )
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Create an artifact in chat to populate this panel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
