import type { Message } from "@/types/chat";
import type { ChatArtifacts } from "@/types/chat";
import { streamCompletion, type StreamStats } from "@/fetches/completion";
import { applyArtifactOperations } from "@/utils/artifact-apply";
import { buildArtifactManifest, buildArtifactProtocolError, buildArtifactSourceContext } from "@/utils/artifact-context";
import { parseArtifactResponse } from "@/utils/artifact-parser";

const MAX_PASSES = 4;

export interface ArtifactLoopStatus {
  pass: number;
  phase: "thinking" | "reading" | "retrying" | "applying" | "finalizing";
  message: string;
}

export interface ArtifactTurnResult {
  content: string;
  artifacts: ChatArtifacts;
  changedPaths: string[];
}

interface RunArtifactTurnParams {
  model: string;
  systemContent: string;
  sessionMessages: Message[];
  userMessage: string;
  artifacts: ChatArtifacts;
  assistantMessageId: string;
  onStatus?: (status: ArtifactLoopStatus | null) => void;
  onStats?: (stats: StreamStats) => void;
  onVisibleContent?: (content: string, pass: number) => void;
  isCancelled?: () => boolean;
}

function aggregateStats(
  totals: { tokens: number; elapsed: number },
  stats: StreamStats
): StreamStats {
  const totalTokens = totals.tokens + stats.totalTokens;
  const elapsed = totals.elapsed + stats.elapsed;

  return {
    totalTokens,
    elapsed,
    done: stats.done,
    tokensPerSecond: elapsed > 0 ? totalTokens / elapsed : 0,
  };
}

function stripMachineBlocks(content: string, parsed: ReturnType<typeof parseArtifactResponse>): string {
  if (parsed.blocks.length === 0) {
    return content.trim();
  }

  let cursor = 0;
  let stripped = "";

  for (const block of parsed.blocks) {
    stripped += content.slice(cursor, block.start);
    cursor = block.end;
  }

  stripped += content.slice(cursor);
  return stripped.trim();
}

function shouldRewriteIntoArtifacts(userMessage: string, content: string) {
  const hasCodeFence = /```[a-zA-Z0-9]*/.test(content);
  const hasCodeLikeContent =
    hasCodeFence ||
    /(^|\n)\s*(import\s.+from\s+['"][^'"]+['"]|export\s+default|export\s+(const|function|class)|interface\s+[A-Z]\w+|type\s+[A-Z]\w+\s*=|const\s+[A-Z]\w+\s*=|function\s+[A-Z]\w+\s*\(|useState\s*\(|useEffect\s*\()/m.test(
      content
    );

  if (!hasCodeLikeContent) {
    return false;
  }

  const lowerUserMessage = userMessage.toLowerCase();
  const artifactIntent =
    /(artifact|file|files|build|create|make|component|ui|page|app|react|tsx|jsx|html|css|javascript|typescript|code)/.test(
      lowerUserMessage
    );
  const fenceCount = (content.match(/```/g) ?? []).length / 2;
  const usageExample = /usage example/i.test(content);

  return artifactIntent || fenceCount > 1 || usageExample;
}

function buildArtifactRewriteInstruction() {
  return [
    "Rewrite your previous response using the artifact filesystem protocol.",
    "Move durable code into <artifact path=\"...\" language=\"...\">...</artifact> blocks.",
    "Use sensible relative file paths like components/Widget.tsx or styles/widget.css.",
    "Default to artifact files for generated code, even if the user only asked for a single component.",
    "Do not use bare fenced code blocks in the rewritten response.",
    "You may keep a short user-facing explanation, but all durable code must be emitted as artifacts.",
    "If the prior response included a usage example, convert it into an artifact only if it is necessary; otherwise omit it.",
    "Respond with the rewritten answer only, not an explanation of the rewrite.",
  ].join("\n");
}

function assertNotCancelled(isCancelled?: () => boolean) {
  if (isCancelled?.()) {
    throw new Error("cancelled");
  }
}

function buildMessages(
  systemContent: string,
  artifacts: ChatArtifacts,
  sessionMessages: Message[],
  userMessage: string,
  loopMessages: Message[]
): Message[] {
  return [
    { role: "system", content: systemContent },
    { role: "system", content: buildArtifactManifest(artifacts) },
    ...sessionMessages,
    { role: "user", content: userMessage },
    ...loopMessages,
  ];
}

export async function runArtifactAwareTurn({
  model,
  systemContent,
  sessionMessages,
  userMessage,
  artifacts,
  assistantMessageId,
  onStatus,
  onStats,
  onVisibleContent,
  isCancelled,
}: RunArtifactTurnParams): Promise<ArtifactTurnResult> {
  let workingArtifacts = artifacts;
  const loopMessages: Message[] = [];
  const statsTotals = { tokens: 0, elapsed: 0 };
  let lastProtocolError =
    "The assistant did not produce a valid artifact response before the loop limit was reached.";

  for (let pass = 1; pass <= MAX_PASSES; pass += 1) {
    assertNotCancelled(isCancelled);
    onStatus?.({
      pass,
      phase: pass === 1 ? "thinking" : "retrying",
      message: `Thinking (${pass}/${MAX_PASSES})`,
    });

    let passContent = "";
    let passFinalStats: StreamStats | undefined;

    await streamCompletion({
      model,
      messages: buildMessages(
        systemContent,
        workingArtifacts,
        sessionMessages,
        userMessage,
        loopMessages
      ),
      update: (content) => {
        passContent = content;
        onVisibleContent?.(content, pass);
      },
      onStats: (stats) => {
        if (stats.done) {
          passFinalStats = stats;
        }
        const aggregated = aggregateStats(statsTotals, stats);
        onStats?.(aggregated);
      },
    });

    if (passFinalStats !== undefined) {
      statsTotals.tokens += passFinalStats.totalTokens;
      statsTotals.elapsed += passFinalStats.elapsed;
    }

    const parsed = parseArtifactResponse(passContent);
    const requestDirectives = parsed.directives.filter(
      (directive) => directive.kind === "request"
    );
    const editDirectives = parsed.directives.filter(
      (directive) => directive.kind === "create" || directive.kind === "replace"
    );
    const strippedContent = stripMachineBlocks(passContent, parsed);

    assertNotCancelled(isCancelled);

    if (requestDirectives.length > 0) {
      if (editDirectives.length > 0 || strippedContent) {
        lastProtocolError =
          "Artifact responses must choose one mode: request files only, or send final edits/prose.";

        onVisibleContent?.("", pass);
        loopMessages.push({ role: "assistant", content: passContent });
        loopMessages.push({
          role: "system",
          content: buildArtifactProtocolError(lastProtocolError),
        });
        continue;
      }

      const requestedPaths = requestDirectives.map((directive) => directive.path);
      const sourceContext = buildArtifactSourceContext(workingArtifacts, requestedPaths);

      if (!sourceContext.ok) {
        lastProtocolError = sourceContext.error;
        onVisibleContent?.("", pass);
        loopMessages.push({ role: "assistant", content: passContent });
        loopMessages.push({
          role: "system",
          content: buildArtifactProtocolError(sourceContext.error),
        });
        continue;
      }

      onStatus?.({
        pass,
        phase: "reading",
        message: `Reading ${requestedPaths.join(", ")}`,
      });

      onVisibleContent?.("", pass);
      loopMessages.push({ role: "assistant", content: passContent });
      loopMessages.push({ role: "system", content: sourceContext.content });
      continue;
    }

    if (editDirectives.length > 0) {
      onStatus?.({
        pass,
        phase: "applying",
        message: "Applying artifact changes",
      });

      const applied = applyArtifactOperations({
        artifacts: workingArtifacts,
        parsed,
        messageId: assistantMessageId,
      });

      if (!applied.ok) {
        lastProtocolError = applied.error;
        onVisibleContent?.("", pass);
        loopMessages.push({ role: "assistant", content: passContent });
        loopMessages.push({
          role: "system",
          content: buildArtifactProtocolError(applied.error),
        });
        continue;
      }

      workingArtifacts = applied.artifacts;

      onStatus?.({
        pass,
        phase: "finalizing",
        message: applied.changedPaths.length
          ? `Updated ${applied.changedPaths.length} artifact${applied.changedPaths.length === 1 ? "" : "s"}`
          : "Finalizing response",
      });

      onStatus?.(null);

      return {
        content: applied.sanitizedContent,
        artifacts: applied.artifacts,
        changedPaths: applied.changedPaths,
      };
    }

    if (shouldRewriteIntoArtifacts(userMessage, passContent) && pass < MAX_PASSES) {
      lastProtocolError = "The response included code blocks but did not use artifact files.";
      onVisibleContent?.("", pass);
      loopMessages.push({ role: "assistant", content: passContent });
      loopMessages.push({
        role: "system",
        content: buildArtifactRewriteInstruction(),
      });
      continue;
    }

    onStatus?.(null);

    return {
      content: strippedContent || passContent.trim(),
      artifacts: workingArtifacts,
      changedPaths: [],
    };
  }

  onStatus?.(null);

  return {
    content: `Sorry, I couldn't complete the artifact update.\n\n${lastProtocolError}`,
    artifacts,
    changedPaths: [],
  };
}
