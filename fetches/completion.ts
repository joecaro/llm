import { Message } from "@/types/chat";

export const fetchCompletion = async (params: {
  model: string;
  messages: Message[];
}) => {
  try {
    const response = await fetch("http://127.0.0.1:11434/v1/chat/completions", {
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

   const res = await response.json()

   const completedMessage = res.choices[0].message.content;

   return completedMessage;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(e as string);
  }
};

export const streamCompletion = async (params: {
  model: string;
  messages: Message[];
  update: (content: string) => void;
}) => {
  try {
    const response = await fetch("http://127.0.0.1:11434/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get completion");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let streamedContent = "";

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
              streamedContent += json.choices[0].delta.content;
              params.update(streamedContent);
            }
          } catch (e) {
            console.error("Error parsing JSON:", e);
          }
        }
      }
    }
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(e as string);
  }
};
