'use client';

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

    // Strip imports and prepare the code
    const processCode = (code: string) => {
      // Remove import statements
      const codeWithoutImports = code.replace(/import\s+.*?from\s+['"].*?['"]/g, '');
      
      // Extract the component code
      const componentCode = codeWithoutImports
        .replace(/export\s+default\s+\w+/, '')
        .replace(/export\s+const\s+/, 'const ');

      return componentCode;
    };

    const iframeContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/babel-standalone@6/babel.min.js"></script>
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
          <script>
            // Mock dependencies
            const cn = (...args) => args.filter(Boolean).join(' ');
            
            // Mock UI components
            const Card = ({ className, children }) => (
              <div className={\`bg-white rounded-lg shadow \${className || ''}\`}>{children}</div>
            );
            
            const CardContent = ({ className, children }) => (
              <div className={\`p-4 \${className || ''}\`}>{children}</div>
            );
            
            const Button = ({ className, children, ...props }) => (
              <button className={\`btn btn-primary \${className || ''}\`} {...props}>{children}</button>
            );
            
            const Input = ({ className, ...props }) => (
              <input className={\`input \${className || ''}\`} {...props} />
            );
            
            const Checkbox = ({ checked, onCheckedChange, className }) => (
              <input 
                type="checkbox" 
                checked={checked} 
                onChange={e => onCheckedChange?.(e.target.checked)}
                className={\`checkbox \${className || ''}\`}
              />
            );
          </script>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            try {
              // Add React import reference
              const { useState } = React;
              
              ${processCode(code)}
              
              const Component = typeof default_1 !== 'undefined' ? default_1 : 
                              typeof Component !== 'undefined' ? Component :
                              typeof TodoList !== 'undefined' ? TodoList : null;
              
              if (Component) {
                // Mock props for preview
                const mockProps = {
                  todos: [
                    { text: 'Learn React', completed: false },
                    { text: 'Build an app', completed: true },
                  ],
                  onToggleCompleted: (index) => console.log('Toggle', index),
                  onCreateTask: (text) => console.log('Create', text),
                };

                const element = React.createElement(Component, mockProps);
                ReactDOM.render(element, document.getElementById('root'));
              } else {
                throw new Error('No valid component found to render');
              }
            } catch (error) {
              const errorDiv = document.createElement('div');
              errorDiv.className = 'p-4 text-red-500 text-sm';
              errorDiv.textContent = 'Error: ' + error.message;
              document.getElementById('root').appendChild(errorDiv);
              console.error('Preview error:', error);
            }
          </script>
        </body>
      </html>
    `;

    return (
      <iframe
        srcDoc={iframeContent}
        className="w-full min-h-[200px] border-none"
        sandbox="allow-scripts"
        title="Component Preview"
        onError={(e: React.SyntheticEvent<HTMLIFrameElement>) => {
          console.error('iframe error:', e);
          setError('Failed to load preview');
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
          <div className="mt-4 border-t border-border pt-4">
            <div className="rounded-lg border border-border bg-card p-4">
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
