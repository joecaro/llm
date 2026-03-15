import { MDXRemote } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import { type ReactNode, useEffect, useRef, useState } from "react";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import remarkGfm from "remark-gfm";
import { ReactComponentPreview } from "./react-component-preview";
import { ArtifactRef as ArtifactRefComponent } from "./artifact-ref";
import { parseMessageContent } from "@/utils/message-parser";
import { cn } from "@/lib/utils";

const FALLBACK_PLACEHOLDER_RE =
  /<(ArtifactRef|ReactComponent)\s+index="(\d+)"\s*\/>/g;

function renderFallbackRichContent(params: {
  message: string;
  components: { code: string }[];
  artifactRefs: { path: string }[];
}) {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = FALLBACK_PLACEHOLDER_RE.exec(params.message)) !== null) {
    const [placeholder, kind, rawIndex] = match;
    const index = Number.parseInt(rawIndex, 10);
    const before = params.message.slice(cursor, match.index);

    if (before.trim()) {
      nodes.push(
        <div key={`text-${key}`} className="whitespace-pre-wrap break-words">
          {before}
        </div>
      );
      key += 1;
    }

    if (kind === "ArtifactRef") {
      const artifactRef = params.artifactRefs[index];
      if (artifactRef) {
        nodes.push(
          <ArtifactRefComponent
            key={`artifact-${key}`}
            path={artifactRef.path}
          />
        );
        key += 1;
      }
    } else {
      const component = params.components[index];
      if (component) {
        nodes.push(
          <ReactComponentPreview
            key={`component-${key}`}
            code={component.code}
          />
        );
        key += 1;
      }
    }

    cursor = match.index + placeholder.length;
  }

  const after = params.message.slice(cursor);
  if (after.trim()) {
    nodes.push(
      <div key={`text-${key}`} className="whitespace-pre-wrap break-words">
        {after}
      </div>
    );
  }

  return nodes;
}

export function MessageContent({
  content,
  chatId: _chatId,
  messageId: _messageId,
}: {
  content: string;
  chatId?: string;
  messageId?: string;
}) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [mdxSource, setMdxSource] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serializingRef = useRef(false);
  const latestContentRef = useRef(content);
  latestContentRef.current = content;
  const parsedContent = parseMessageContent(content);
  const safeFallbackContent = parsedContent.message.trim();
  const containsArtifactProtocol = /<artifact(?:-request|-replace|-ref)?\b/.test(content);
  const fallbackHasRichPlaceholders = FALLBACK_PLACEHOLDER_RE.test(
    safeFallbackContent
  );
  FALLBACK_PLACEHOLDER_RE.lastIndex = 0;

  const runSerializeRef = useRef(async function runSerialize(text: string) {
    if (typeof text !== "string" || !text.trim()) {
      setMdxSource(null);
      return;
    }

    const isArtifactProtocolText = /<artifact(?:-request|-replace|-ref)?\b/.test(
      text
    );

    serializingRef.current = true;
    try {
      const { message, components = [], artifactRefs = [] } = parseMessageContent(text);

      const mdxComponents = {
        ReactComponent: ({ index }: { index: string }) => {
          const component = components[parseInt(index, 10)];
          return component ? (
            <ReactComponentPreview code={component.code} />
          ) : null;
        },
        ArtifactRef: ({ index }: { index: string }) => {
          const artifactRef = artifactRefs[parseInt(index, 10)];
          return artifactRef ? <ArtifactRefComponent path={artifactRef.path} /> : null;
        },
      };

      const result = await serialize(message, {
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          format: "mdx",
        },
      });

      setMdxSource({
        ...result,
        frontmatter: { components: mdxComponents },
      });
      setError(null);
    } catch (err) {
      setMdxSource(null);

      if (!isArtifactProtocolText) {
        console.error("Error serializing MDX:", err);
        setError(
          err instanceof Error ? err.message : "Error processing content"
        );
      } else {
        setError(null);
      }
    } finally {
      serializingRef.current = false;
    }

    if (latestContentRef.current !== text) {
      runSerializeRef.current(latestContentRef.current);
    }
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (serializingRef.current) return;
      runSerializeRef.current(latestContentRef.current);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content]);

  // Only run Prism after MDX renders, not on every content change
  useEffect(() => {
    if (mdxSource && codeRef.current) {
      Prism.highlightAllUnder(codeRef.current, true);
    }
  }, [mdxSource]);

  if (!content) {
    return (
      <span className="flex items-center gap-2 p-2">
        {[1, 2, 3].map((i) => (
          <span
            className={cn(
              "inline-block w-2 h-2 bg-muted rounded-full animate-bounce",
              i === 1 && "delay-100",
              i === 2 && "delay-300",
              i === 3 && "delay-500"
            )}
            key={i}
          ></span>
        ))}
      </span>
    );
  }

  if (!mdxSource) {
    if (!safeFallbackContent && containsArtifactProtocol) {
      return (
        <div className="border p-2 text-primary border-border bg-muted/50 rounded-lg shadow overflow-hidden">
          <div className="text-sm text-muted-foreground">Preparing artifacts...</div>
        </div>
      );
    }

    if (fallbackHasRichPlaceholders) {
      return (
        <div className="w-full border p-2 text-primary border-border bg-muted/50 rounded-lg shadow overflow-hidden max-w-full space-y-3">
          {renderFallbackRichContent({
            message: parsedContent.message,
            components: parsedContent.components,
            artifactRefs: parsedContent.artifactRefs,
          })}
        </div>
      );
    }

    return (
      <div className="border p-2 text-primary border-border bg-muted/50 rounded-lg shadow overflow-hidden">
        <pre className="whitespace-pre-wrap break-words">
          {safeFallbackContent || content}
        </pre>
      </div>
    );
  }

  return (
    <div
      className="w-full border p-2 text-primary border-border bg-muted/50 rounded-lg shadow overflow-hidden max-w-full prose dark:prose-invert prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:p-4 prose-pre:overflow-x-auto prose-code:text-pink-500 dark:prose-code:text-pink-400 prose-code:before:content-none prose-code:after:content-none prose-headings:text-primary prose-a:text-blue-500 dark:prose-a:text-blue-400 prose-strong:text-primary prose-em:text-primary prose-blockquote:text-muted-foreground prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic"
      ref={codeRef}
    >
      <MDXRemote {...mdxSource} components={mdxSource.frontmatter.components} />
      {error && (
        <div className="text-xs text-destructive mt-2">Rendering Error: {error}</div>
      )}
    </div>
  );
}
