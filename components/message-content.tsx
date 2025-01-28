import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import { useEffect, useRef } from "react";
import { cn } from "@/utils/cn";

export function MessageContent({ content }: { content: string }) {
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightAllUnder(codeRef.current);
    }
  }, [content]);

  return (
    <div ref={codeRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-invert max-w-none"
        components={{
          // @ts-expect-error - PrismJS types are not fully compatible with ReactMarkdown
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            
            if (!inline && match) {
              return (
                <div className="relative my-4">
                  <pre className="!p-0 !m-0">
                    <code
                      className={cn(
                        `language-${match[1]}`,
                        "block bg-zinc-900 border border-zinc-800 rounded-lg",
                        "p-4 text-sm whitespace-pre"
                      )}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </code>
                  </pre>
                </div>
              );
            }

            // For inline code
            return (
              <code
                className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
