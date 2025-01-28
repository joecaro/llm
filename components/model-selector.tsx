"use client";

import { useState } from "react";

const MODELS = [
  { id: "deepseek-r1:7b", name: "DeepSeek R1" },
  { id: "llama3.2", name: "Llama 3.2" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export function ModelSelector({
  onModelChange,
}: {
  onModelChange: (model: ModelId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelId>("llama3.2");

  const handleModelSelect = (modelId: ModelId) => {
    setSelectedModel(modelId);
    onModelChange(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-3 py-1 text-sm text-muted-foreground 
          hover:text-foreground transition rounded-md bg-muted/50 hover:bg-muted 
          border border-border h-full cursor-pointer"
      >
        <span>
          {MODELS.find((m) => m.id === selectedModel)?.name}
        </span>
      </div>

      {isOpen && (
        <div 
          className="absolute bottom-full left-0 mb-2 bg-background/95 backdrop-blur-sm 
            border border-border rounded-lg overflow-hidden shadow-lg"
          onClick={(e) => e.preventDefault()}
        >
          {MODELS.map((model) => (
            <div
              key={model.id}
              onClick={(e) => {
                e.preventDefault();
                handleModelSelect(model.id);
              }}
              className={`px-4 py-2 text-left text-sm hover:bg-muted transition cursor-pointer
                ${selectedModel === model.id
                  ? "bg-muted/50 text-foreground"
                  : "text-muted-foreground"
                }`}
            >
              {model.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
