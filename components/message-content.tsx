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
import "prismjs/components/prism-python";
import { useEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import CopyButton from "@/components/copy-button";
import { motion } from "framer-motion";

export function MessageContent({ content }: { content: string }) {
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightAllUnder(codeRef.current, true, (e) => {
        console.log(e);
        console.log("highlighted");
      });
    }
  }, [content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="border p-2 text-primary border-neutral-600 bg-muted/50 rounded-lg shadow"
      ref={codeRef}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-invert max-w-none"
        components={{
          // @ts-expect-error - PrismJS types are not fully compatible with ReactMarkdown
          code({ /* node, */ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");

            if (!inline && match) {
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                  className="relative my-4"
                >
                  <CopyButton text={String(children)} />
                  <pre className="!p-0 !m-0">
                    <code
                      className={cn(
                        `language-${match[1]}`,
                        "block bg-zinc-900 border border-zinc-800 rounded-lg",
                        "p-4 text-sm whitespace-pre"
                      )}
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </code>
                  </pre>
                </motion.div>
              );
            }

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
    </motion.div>
  );
}
