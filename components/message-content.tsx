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
import { parseMessageContent } from "@/utils/message-parser";

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

        // Parse the content to extract React components
        const { message, components = [] } = parseMessageContent(content);

        // Create a components object for MDX
        const mdxComponents = {
          ReactComponent: ({ index }: { index: string }) => {
            const component = components[parseInt(index, 10)];
            return component ? (
              <ReactComponentPreview code={component.code} />
            ) : null;
          },
        };

        const mdxSource = await serialize(message, {
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            format: "mdx",
          },
        });

        setMdxSource({ ...mdxSource, frontmatter: { components: mdxComponents } });
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
      className="w-full border p-2 text-primary border-border bg-muted/50 rounded-lg shadow overflow-x-auto max-w-[1100px] prose prose-invert prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-800 prose-pre:rounded-md prose-pre:p-4 prose-code:text-pink-400 prose-code:before:content-none prose-code:after:content-none prose-headings:text-primary prose-a:text-blue-400 prose-strong:text-primary prose-em:text-primary prose-blockquote:text-neutral-300 prose-blockquote:border-l-4 prose-blockquote:border-neutral-700 prose-blockquote:pl-4 prose-blockquote:italic"
      ref={codeRef}
    >
      <MDXRemote {...mdxSource} components={mdxSource.frontmatter.components} />
      {error || !mdxSource ? (
        <div className="absolute top-0 right-0 px-2">Rendering Error</div>
      ) : null}
    </div>
  );
}