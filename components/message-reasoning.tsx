"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { parseMessageContent } from "@/utils/message-parser";
import { motion } from "framer-motion";

export function MessageReasoning({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { reasoning } = parseMessageContent(content);

  if (!reasoning) return null;

  return (
    <motion.div layout className="mt-2 border-t border-white/10">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition py-2"
      >
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 transition-transform duration-200" />
        ) : (
          <ChevronDown className="w-4 h-4 transition-transform duration-200" />
        )}
        Reasoning
      </button>
      
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="pb-2 text-sm text-white/70 whitespace-pre-wrap">
          {reasoning}
        </div>
      </div>
    </motion.div>
  );
} 