import { MDXRemote } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import { useEffect, useRef, useState } from "react";
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

  const runSerializeRef = useRef(async function runSerialize(text: string) {
    if (typeof text !== "string" || !text.trim()) {
      setMdxSource(null);
      return;
    }

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
      console.error("Error serializing MDX:", err);
      setError(
        err instanceof Error ? err.message : "Error processing content"
      );
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
    return (
      <div className="border p-2 text-primary border-border bg-muted/50 rounded-lg shadow overflow-hidden">
        <pre className="whitespace-pre-wrap break-words">{content}</pre>
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
