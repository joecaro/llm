import type { Chat, ChatArtifacts, ChatMessage, ChatSession } from "@/types/chat";

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

function normalizeMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    activities: Array.isArray(message.activities)
      ? message.activities.map((activity) => ({
          ...activity,
          detail: activity.detail ? { ...activity.detail } : undefined,
        }))
      : undefined,
  };
}

export function normalizeChat(input: Partial<Chat> & Pick<Chat, "id" | "title" | "createdAt">): Chat {
  const sessions =
    input.sessions && input.sessions.length > 0
      ? input.sessions.map((session) => ({
          ...session,
          messages: (session.messages ?? []).map(normalizeMessage),
        }))
      : input.messages && input.messages.length > 0
        ? [
            {
              id: "migrated",
              messages: input.messages.map(normalizeMessage),
            },
          ]
        : [createEmptySession()];

  return {
    id: input.id,
    title: input.title,
    messages: (input.messages ?? sessions.flatMap((session) => session.messages)).map(
      normalizeMessage
    ),
    sessions,
    createdAt: input.createdAt,
    modelId: input.modelId,
    artifacts: input.artifacts ?? createEmptyArtifacts(),
  };
}
