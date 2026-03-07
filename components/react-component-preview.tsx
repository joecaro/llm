"use client";

import { type FC } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, Play } from "lucide-react";
import { useState } from "react";

interface ReactComponentPreviewProps {
  code: string;
  className?: string;
}

export const ReactComponentPreview: FC<ReactComponentPreviewProps> = ({
  code,
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Create an iframe sandbox for rendering the component
  const renderPreview = () => {
    if (!isPreviewVisible) return null;

    // Strip imports and prepare the code, returning [processedCode, componentName]
    const processCode = (code: string): [string, string | null] => {
      // Extract component name from export patterns
      let componentName: string | null = null;

      // Match "export const Name = " or "export default Name"
      const namedExport = code.match(/export\s+const\s+(\w+)\s*=/);
      const defaultExport = code.match(/export\s+default\s+(\w+)/);
      componentName = namedExport?.[1] || defaultExport?.[1] || null;

      // Remove import statements
      const codeWithoutImports = code.replace(
        /import\s+.*?from\s+['"].*?['"]/g,
        ""
      );

      // Extract the component code
      const componentCode = codeWithoutImports
        .replace(/export\s+default\s+\w+/, "")
        .replace(/export\s+const\s+/, "const ");

      return [componentCode, componentName];
    };

    const [processedCode, componentName] = processCode(code);

    const iframeContent = `
      <!DOCTYPE html>
      <html style="height: 100%;">
        <head>
          <meta charset="utf-8">
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; font-family: system-ui, sans-serif; }
            .btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 0.375rem;
              padding: 0.5rem 1rem;
              font-weight: 500;
              transition: all 0.2s;
              cursor: pointer;
            }
            .btn-primary {
              background-color: hsl(222.2 47.4% 11.2%);
              color: white;
            }
            .btn:hover {
              opacity: 0.9;
            }
            .input {
              width: 100%;
              padding: 0.5rem;
              border: 1px solid hsl(240 3.7% 15.9%);
              border-radius: 0.375rem;
            }
            .checkbox {
              width: 1rem;
              height: 1rem;
              border-radius: 0.25rem;
              border: 1px solid hsl(240 3.7% 15.9%);
            }
          </style>
        </head>
        <body style="height: 100%;">
          <div style="height: 100%;" id="root"></div>
          <div id="loading" style="padding: 1rem; color: #888; font-size: 0.875rem;">Loading preview...</div>
          <script>
            // Wait for all CDN scripts to load, then transpile and run manually
            function __run() {
              document.getElementById('loading').remove();

              // Mock UI primitives
              var cn = function() {
                return Array.prototype.filter.call(arguments, Boolean).join(' ');
              };
              var Card = function(props) {
                return React.createElement('div', {
                  className: 'bg-white rounded-lg shadow ' + (props.className || '')
                }, props.children);
              };
              var CardContent = function(props) {
                return React.createElement('div', {
                  className: 'p-4 ' + (props.className || '')
                }, props.children);
              };
              var Button = function(props) {
                var className = props.className, children = props.children;
                var rest = Object.assign({}, props);
                delete rest.className; delete rest.children;
                return React.createElement('button', Object.assign({
                  className: 'btn btn-primary ' + (className || '')
                }, rest), children);
              };
              var Input = function(props) {
                var className = props.className;
                var rest = Object.assign({}, props);
                delete rest.className;
                return React.createElement('input', Object.assign({
                  className: 'input ' + (className || '')
                }, rest));
              };
              var Checkbox = function(props) {
                return React.createElement('input', {
                  type: 'checkbox',
                  checked: props.checked,
                  onChange: function(e) { props.onCheckedChange && props.onCheckedChange(e.target.checked); },
                  className: 'checkbox ' + (props.className || '')
                });
              };

              var componentCode = ${JSON.stringify(processedCode)};
              var componentName = ${JSON.stringify(componentName)};

              try {
                var transpiled = Babel.transform(componentCode, {
                  presets: ['react', 'typescript'],
                  filename: 'component.tsx'
                }).code;

                // Wrap in a function that has access to our mocked components
                var factory = new Function(
                  'React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback',
                  'Card', 'CardContent', 'Button', 'Input', 'Checkbox', 'cn',
                  transpiled + '\\nreturn typeof ' + componentName + ' !== "undefined" ? ' + componentName + ' : null;'
                );

                var Component = factory(
                  React, React.useState, React.useEffect, React.useRef, React.useMemo, React.useCallback,
                  Card, CardContent, Button, Input, Checkbox, cn
                );

                if (Component) {
                  ReactDOM.render(React.createElement(Component, {}), document.getElementById('root'));
                } else {
                  throw new Error('No component found: ' + componentName);
                }
              } catch (error) {
                var errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 text-red-500 text-sm';
                errorDiv.textContent = 'Error: ' + error.message;
                document.getElementById('root').appendChild(errorDiv);
                console.error('Preview error:', error);
              }
            }

            // Poll until all dependencies are loaded
            function __waitForDeps() {
              if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined' && typeof Babel !== 'undefined') {
                __run();
              } else {
                setTimeout(__waitForDeps, 50);
              }
            }
            __waitForDeps();
          </script>
        </body>
      </html>
    `;

    return (
      <iframe
        srcDoc={iframeContent}
        className="w-full min-h-[200px] h-full border-none"
        sandbox="allow-scripts"
        title="Component Preview"
        onError={(e: React.SyntheticEvent<HTMLIFrameElement>) => {
          console.error("iframe error:", e);
          setError("Failed to load preview");
        }}
      />
    );
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">React Component</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="sr-only">Copy code</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8"
            onClick={() => {
              setIsPreviewVisible(!isPreviewVisible);
              setError(null);
            }}
          >
            <Play className="h-4 w-4" />
            <span className="sr-only">Toggle preview</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isPreviewVisible ? (
          <div className="mt-4 border-t border-border pt-4 h-[500px]">
            <div className="rounded-lg border border-border bg-card p-4 h-full">
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : (
                renderPreview()
              )}
            </div>
          </div>
        ) : (
          <pre className="relative rounded-md bg-muted p-4">
            <code className="block text-sm font-mono text-muted-foreground whitespace-pre-wrap">
              {code}
            </code>
          </pre>
        )}
      </CardContent>
    </Card>
  );
};
