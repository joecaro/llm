import type { Chat, ChatArtifacts, ChatSession } from "@/types/chat";

export function createEmptyArtifacts(): ChatArtifacts {
  return {
    files: {},
    order: [],
  };
}

export function createEmptySession(): ChatSession {
  return {
    id: crypto.randomUUID(),
    messages: [],
  };
}

export function createEmptyChat(modelId?: string): Chat {
  return {
    id: crypto.randomUUID(),
    title: "New Chat",
    messages: [],
    sessions: [createEmptySession()],
    createdAt: Date.now(),
    modelId,
    artifacts: createEmptyArtifacts(),
  };
}

export function normalizeChat(input: Partial<Chat> & Pick<Chat, "id" | "title" | "createdAt">): Chat {
  const sessions =
    input.sessions && input.sessions.length > 0
      ? input.sessions.map((session) => ({
          ...session,
          messages: session.messages ?? [],
        }))
      : input.messages && input.messages.length > 0
        ? [
            {
              id: "migrated",
              messages: input.messages,
            },
          ]
        : [createEmptySession()];

  return {
    id: input.id,
    title: input.title,
    messages: input.messages ?? sessions.flatMap((session) => session.messages),
    sessions,
    createdAt: input.createdAt,
    modelId: input.modelId,
    artifacts: input.artifacts ?? createEmptyArtifacts(),
  };
}
