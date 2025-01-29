import { RefObject } from "react";
import { ModelSelector, ModelId } from "./model-selector";
import { useFormStatus } from "react-dom";
import { SendHorizontal } from "lucide-react";
import { useRef, useEffect } from "react";
import { Textarea } from "./ui/textarea";

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

interface UserInputProps {
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: (formData: FormData) => void;
  isLoading: boolean;
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
}

export default function UserInput({
  formRef,
  onSubmit,
  isLoading,
  selectedModel,
  onModelChange,
}: UserInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcut to focus textarea
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (but not with Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }

    // Clear on Escape
    if (e.key === "Escape") {
      e.preventDefault();
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
    }
  };

  return (
    <div className="border-t p-4">
      <form ref={formRef} action={onSubmit} className="flex gap-4 items-start">
        <ModelSelector value={selectedModel} onChange={onModelChange} />
        <Textarea
          name="message"
          placeholder="Message... (⌘K to focus, ↵ to send, shift+↵ for newline)"
          className="flex-1 p-3 rounded-lg bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring text-sm text-foreground placeholder:text-muted-foreground resize-none overflow-hidden min-h-[44px] max-h-[200px] border border-border"
          disabled={isLoading}
          onKeyDown={handleKeyPress}
          ref={textareaRef}
        />
        <SubmitButton />
      </form>
    </div>
  );
}
