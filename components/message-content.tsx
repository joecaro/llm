import { MDXRemote } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import CopyButton from "@/components/copy-button";
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

export function MessageContent({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming?: boolean;
}) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [mdxSource, setMdxSource] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightAllUnder(codeRef.current, true);
    }
  }, [content]);

  useEffect(() => {
    async function serializeMdx() {
      try {
        // Ensure content is a string and not empty
        if (typeof content !== "string" || !content.trim()) {
          setMdxSource(null);
          return;
        }

        const mdxSource = await serialize(content, {
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            format: "mdx",
          },
        });
        setMdxSource(mdxSource);
        setError(null);
      } catch (err) {
        console.error("Error serializing MDX:", err);
        setError(
          err instanceof Error ? err.message : "Error processing content"
        );
      }
    }
    serializeMdx();
  }, [content]);

  if (!mdxSource) {
    // Fallback to plain text display
    return (
      <div className="border p-2 text-primary border-neutral-600 bg-muted/50 rounded-lg shadow">
        <pre className="whitespace-pre-wrap">{content}</pre>
      </div>
    );
  }

  return (
    <div
      className="border p-2 text-primary border-neutral-600 bg-muted/50 rounded-lg shadow overflow-x-auto max-w-full"
      ref={codeRef}
    >
      <MDXRemote {...mdxSource} />
      {error || !mdxSource ? (
        <div className="absolute top-0 right-0 px-2">Rendering Error</div>
      ) : null}
    </div>
  );
}