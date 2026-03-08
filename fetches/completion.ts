import { Message } from "@/types/chat";
import { getLlmUrl } from "@/lib/llm-config";

async function getPrompt() {
  try {
    const response = await fetch("/api/prompt", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load prompt");
    }

    const data = await response.json();
    return typeof data.prompt === "string" ? data.prompt : "";
  } catch (error) {
    console.error("Failed to load prompt:", error);
    return "";
  }
}

export const fetchCompletion = async (params: {
  model: string;
  messages: Message[];
}) => {
  try {
    const response = await fetch(getLlmUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get completion");
    }

    const res = await response.json();

    const completedMessage = res.choices[0].message.content;

    return completedMessage;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(e as string);
  }
};

export interface StreamStats {
  tokensPerSecond: number;
  totalTokens: number;
  elapsed: number;
  done: boolean;
}

export const streamCompletion = async (params: {
  model: string;
  messages: Message[];
  update: (content: string) => void;
  onStats?: (stats: StreamStats) => void;
}) => {
  try {
    const prompt = await getPrompt();
    const response = await fetch(getLlmUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: [{ role: "system", content: prompt }, ...params.messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get completion");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let streamedContent = "";
    let buffer = "";
    let tokenCount = 0;
    const startTime = performance.now();

    const handleLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line || line === "data: [DONE]") return;

      try {
        const jsonString = line.replace(/^data:\s*/, "");
        const json = JSON.parse(jsonString);

        if (json.choices?.[0]?.delta?.content) {
          tokenCount++;
          streamedContent += json.choices[0].delta.content;
          params.update(streamedContent);

          const elapsed = (performance.now() - startTime) / 1000;
          params.onStats?.({
            tokensPerSecond: elapsed > 0 ? tokenCount / elapsed : 0,
            totalTokens: tokenCount,
            elapsed,
            done: false,
          });
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    };

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          handleLine(line);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        handleLine(buffer);
      }

      const elapsed = (performance.now() - startTime) / 1000;
      params.onStats?.({
        tokensPerSecond: elapsed > 0 ? tokenCount / elapsed : 0,
        totalTokens: tokenCount,
        elapsed,
        done: true,
      });
    }
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(e as string);
  }
};
