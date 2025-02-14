import type { MDXComponents } from 'mdx/types';
import { cn } from "@/utils/cn";
import CopyButton from "@/components/copy-button";
import Prism from "prismjs";
import { useEffect, useRef } from "react";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    // Customize built-in components
    code: function Code({ children, className, ...props }) {
      const codeRef = useRef<HTMLElement>(null);
      const match = /language-(\w+)/.exec(className || '');

      useEffect(() => {
        if (codeRef.current) {
          Prism.highlightElement(codeRef.current, true);
        }
      }, []);

      if (!match) {
        return (
          <code
            className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <div className="relative my-4">
          <CopyButton text={String(children)} />
          <pre className="!p-0 !m-0">
            <code
              ref={codeRef}
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
        </div>
      );
    },
    pre: ({ children }) => <>{children}</>,
  };
} 