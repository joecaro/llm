import { RefObject } from "react";
import { ModelSelector, ModelId } from "./model-selector";
import { useFormStatus } from "react-dom";
import { SendHorizontal, FileText } from "lucide-react";
import { useRef, useEffect, useCallback } from "react";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useChatStore } from "@/store/chat-store";
import { createNewChat } from "@/utils/chat-storage";

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
  hideSelector?: boolean;
}

export default function UserInput({
  formRef,
  onSubmit,
  isLoading,
  selectedModel,
  onModelChange,
  hideSelector,
}: UserInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addChat = useChatStore.use.addChat();

  const handleNewChat = useCallback(() => {
    const newChat = createNewChat();
    addChat(newChat);
  }, [addChat]);
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcut to focus textarea
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === "˚") {
        console.log("New chat");
        e.preventDefault();
        handleNewChat();
        textareaRef.current?.focus();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewChat]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        if (textareaRef.current) {
          textareaRef.current.value = (
            textareaRef.current.value +
            "\n\nFile content:\n" +
            content
          ).trim();
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="border-t border-border drop-shadow-md p-2 md:p-4 bg-midground/50 flex gap-2">
      <form ref={formRef} action={onSubmit} className="flex gap-2 flex-1 items-start">
        <div className="flex-1 relative min-w-0">
          <div className="max-h-[500px] overflow-y-auto flex-1 rounded-lg bg-muted/50 w-full border border-border">
            <Textarea
              name="message"
              placeholder="Message... (⌘K to focus, ↵ to send)"
              className="focus:outline-none focus:ring-1 focus:ring-ring text-sm text-foreground placeholder:text-muted-foreground resize-none min-h-[44px] overflow-hidden"
              disabled={isLoading}
              onKeyDown={handleKeyPress}
              onChange={adjustTextareaHeight}
              onInput={adjustTextareaHeight}
              ref={textareaRef}
            />
          </div>
          <Button
            variant="ghost"
            onClick={handleFileButtonClick}
            className="absolute right-2 bottom-1 p-0 rounded transition text-muted-foreground hover:text-foreground"
            title="Attach text file"
          >
            <FileText className="w-4 h-4" />
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt"
            className="hidden"
          />
        </div>
        <SubmitButton />
      </form>
      {!hideSelector && <ModelSelector value={selectedModel} onChange={onModelChange} />}
    </div>
  );
}
