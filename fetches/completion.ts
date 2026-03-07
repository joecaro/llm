import { Message } from "@/types/chat";
import { getLlmUrl } from "@/lib/llm-config";

let PROMPT: string | null = null;

async function getPrompt() {
  if (PROMPT) return PROMPT;
  
  try {
    const response = await fetch('/api/prompt');
    const data = await response.json();
    PROMPT = data.prompt;
    return PROMPT;
  } catch (error) {
    console.error('Failed to load prompt:', error);
    return '';
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
    let tokenCount = 0;
    const startTime = performance.now();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            if (line === "data: [DONE]") continue;

            const jsonString = line.replace(/^data: /, "");
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
          } catch (e) {
            console.error("Error parsing JSON:", e);
          }
        }
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
