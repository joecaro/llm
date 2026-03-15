import { NextRequest, NextResponse } from "next/server";
import {
  executeHarnessToolCalls,
} from "@/lib/harness-tools";
import type { HarnessToolCall } from "@/lib/harness-protocol";

export const runtime = "nodejs";

function isToolCall(value: unknown): value is HarnessToolCall {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as HarnessToolCall).name === "string" &&
      (value as HarnessToolCall).input &&
      typeof (value as HarnessToolCall).input === "object" &&
      !Array.isArray((value as HarnessToolCall).input)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { calls?: unknown };
    const rawCalls = Array.isArray(body.calls) ? body.calls : [];
    const calls = rawCalls.filter(isToolCall).slice(0, 8);

    if (calls.length === 0) {
      return NextResponse.json(
        { error: "No valid harness tool calls were provided." },
        { status: 400 }
      );
    }

    const results = await executeHarnessToolCalls(calls);
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to execute harness tools.",
      },
      { status: 500 }
    );
  }
}
