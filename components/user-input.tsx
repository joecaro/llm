import { useFormStatus } from "react-dom";
import { ModelId, ModelSelector } from "./model-selector";
import { SendHorizontal } from "lucide-react";
import { useRef, useEffect } from "react";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition 
        disabled:opacity-50 text-foreground"
      aria-label="Send message"
    >
      <SendHorizontal className="w-5 h-5" />
    </button>
  );
}

export default function UserInput({
  formRef,
  handleSubmit,
  setSelectedModel,
  isLoading,
  messages,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  handleSubmit: (formData: FormData) => void;
  setSelectedModel: (model: ModelId) => void;
  isLoading: boolean;
  messages: { role: string; content: string }[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcut to focus textarea
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (but not with Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }

    // Clear on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-3xl mx-auto p-4">
        <form
          ref={formRef}
          action={handleSubmit}
          className="flex items-center gap-4 max-w-2xl mx-auto"
        >
          {messages.map((message, index) => (
            <input
              key={index}
              type="hidden"
              name={`messages[${index}][role]`}
              value={message.role}
            />
          ))}
          {messages.map((message, index) => (
            <input
              key={index}
              type="hidden"
              name={`messages[${index}][content]`}
              value={message.content}
            />
          ))}

          <div className="shrink-0">
            <ModelSelector onModelChange={setSelectedModel} />
          </div>

          <textarea
            ref={textareaRef}
            name="message"
            placeholder="Message... (⌘K to focus, ↵ to send, shift+↵ for newline)"
            className="flex-1 p-3 rounded-lg bg-muted/50 focus:outline-none focus:ring-1 
              focus:ring-ring text-sm text-foreground placeholder:text-muted-foreground 
              resize-none overflow-hidden min-h-[44px] max-h-[200px] border border-border"
            required
            disabled={isLoading}
            rows={1}
            onKeyDown={handleKeyPress}
            onInput={(e) => {
              const textarea = e.currentTarget;
              textarea.style.height = "auto";
              textarea.style.height = `${textarea.scrollHeight}px`;
            }}
          />

          <div className="shrink-0">
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
