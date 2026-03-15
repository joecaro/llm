import { NextRequest, NextResponse } from "next/server";
import { loadConversationState, saveConversationState } from "@/lib/conversation-storage";
import type { Chat } from "@/types/chat";

export const runtime = "nodejs";

function isChatArray(value: unknown): value is Chat[] {
  return Array.isArray(value);
}

export async function GET() {
  try {
    const snapshot = await loadConversationState();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load conversations.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      chats?: unknown;
      currentChatId?: unknown;
    };

    if (!isChatArray(body.chats)) {
      return NextResponse.json(
        { error: "Expected `chats` to be an array." },
        { status: 400 }
      );
    }

    await saveConversationState({
      chats: body.chats,
      currentChatId:
        typeof body.currentChatId === "string" ? body.currentChatId : null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save conversations.",
      },
      { status: 500 }
    );
  }
}
