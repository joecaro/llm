import type { ArtifactLanguage, Message } from "@/types/chat";
import type { ChatArtifacts } from "@/types/chat";
import { streamCompletion, type StreamStats } from "@/fetches/completion";
import {
  buildHarnessProtocolError,
  buildHarnessToolManifest,
  buildHarnessToolResultsContext,
  type HarnessToolCall,
  type HarnessToolResult,
} from "@/lib/harness-protocol";
import { applyArtifactOperations } from "@/utils/artifact-apply";
import {
  buildArtifactManifest,
  buildArtifactSourceContext,
} from "@/utils/artifact-context";
import type { ParsedArtifactResponse } from "@/utils/artifact-parser";
import { parseArtifactResponse } from "@/utils/artifact-parser";
import { parseToolCallResponse } from "@/utils/harness-parser";

const MAX_PASSES = 6;

interface MachineBlock {
  start: number;
  end: number;
}

export interface HarnessLoopStatus {
  pass: number;
  phase:
    | "thinking"
    | "reading"
    | "calling-tools"
    | "retrying"
    | "applying"
    | "finalizing";
  message: string;
}

export interface HarnessTurnResult {
  content: string;
  artifacts: ChatArtifacts;
  changedPaths: string[];
}

interface RunHarnessTurnParams {
  model: string;
  systemContent: string;
  sessionMessages: Message[];
  userMessage: string;
  artifacts: ChatArtifacts;
  assistantMessageId: string;
  onStatus?: (status: HarnessLoopStatus | null) => void;
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

function stripMachineBlocks(content: string, blocks: MachineBlock[]): string {
  if (blocks.length === 0) {
    return content.trim();
  }

  const sortedBlocks = [...blocks].sort((left, right) => left.start - right.start);
  let cursor = 0;
  let stripped = "";

  for (const block of sortedBlocks) {
    stripped += content.slice(cursor, block.start);
    cursor = block.end;
  }

  stripped += content.slice(cursor);
  return stripped.trim();
}

function assertNotCancelled(isCancelled?: () => boolean) {
  if (isCancelled?.()) {
    throw new Error("cancelled");
  }
}

function pickUniqueArtifactPath(
  artifacts: ChatArtifacts,
  basePath: string
): string {
  if (!artifacts.files[basePath]) {
    return basePath;
  }

  const dotIndex = basePath.lastIndexOf(".");
  const stem = dotIndex === -1 ? basePath : basePath.slice(0, dotIndex);
  const extension = dotIndex === -1 ? "" : basePath.slice(dotIndex);

  let counter = 2;
  while (artifacts.files[`${stem}-${counter}${extension}`]) {
    counter += 1;
  }

  return `${stem}-${counter}${extension}`;
}

function looksLikeCsv(content: string): boolean {
  const lines = content
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (lines.length < 2) {
    return false;
  }

  const columnCounts = lines.map((line) => line.split(",").length);
  return columnCounts.every((count) => count > 1 && count === columnCounts[0]);
}

function inferFallbackDocumentPath(
  content: string,
  userMessage: string
): { path: string; language: string } {
  const lowerContent = content.toLowerCase();
  const lowerUserMessage = userMessage.toLowerCase();

  if (lowerUserMessage.includes("csv") || looksLikeCsv(content)) {
    return {
      path: "data/export.csv",
      language: "csv",
    };
  }

  if (lowerContent.includes("```mermaid") || /\b(mermaid|diagram)\b/.test(lowerUserMessage)) {
    return {
      path: "docs/diagram.md",
      language: "md",
    };
  }

  if (
    /\bsubject:\s*/i.test(content) ||
    /\bdear\s+\[?.+?\]?,/i.test(content) ||
    lowerUserMessage.includes("email")
  ) {
    return {
      path: "drafts/email.md",
      language: "md",
    };
  }

  if (/\b(plan|brief|roadmap)\b/.test(lowerUserMessage)) {
    return {
      path: "docs/plan.md",
      language: "md",
    };
  }

  if (/\b(report|summary|analysis)\b/.test(lowerUserMessage)) {
    return {
      path: "reports/summary.md",
      language: "md",
    };
  }

  if (
    lowerContent.includes("# ") ||
    lowerContent.includes("## ") ||
    lowerUserMessage.includes("markdown")
  ) {
    return {
      path: "docs/document.md",
      language: "md",
    };
  }

  return {
    path: "docs/draft.md",
    language: "md",
  };
}

function inferFallbackCodePath(
  language: string | undefined,
  userMessage: string
): string {
  const normalizedLanguage = (language ?? "").toLowerCase();

  if (normalizedLanguage === "tsx" || normalizedLanguage === "jsx") {
    const match = userMessage.match(/\b([A-Z][A-Za-z0-9]+)\b/);
    const stem = match?.[1] ?? "GeneratedComponent";
    return `components/${stem}.${normalizedLanguage || "tsx"}`;
  }

  if (normalizedLanguage === "css") {
    return "styles/generated.css";
  }

  if (normalizedLanguage === "html") {
    return "pages/generated.html";
  }

  if (normalizedLanguage === "json") {
    return "data/generated.json";
  }

  if (normalizedLanguage === "js" || normalizedLanguage === "ts") {
    return `src/generated.${normalizedLanguage}`;
  }

  return "docs/snippet.txt";
}

function buildSyntheticCreateResponse(params: {
  path: string;
  language: string;
  fileContent: string;
  intro?: string;
}): ParsedArtifactResponse {
  const intro = params.intro?.trim();
  const prefix = intro ? `${intro}\n\n` : "";
  const artifactMarkup = `<artifact path="${params.path}" language="${params.language}">\n${params.fileContent}\n</artifact>`;
  const content = `${prefix}${artifactMarkup}`;
  const start = prefix.length;

  return {
    content,
    directives: [
      {
        kind: "create",
        path: params.path,
        language: params.language,
        content: params.fileContent,
      },
    ],
    blocks: [
      {
        kind: "create",
        path: params.path,
        language: params.language as ArtifactLanguage,
        start,
        end: start + artifactMarkup.length,
      },
    ],
  };
}

function synthesizeArtifactFallback(params: {
  content: string;
  userMessage: string;
  sessionMessages: Message[];
  artifacts: ChatArtifacts;
}): ParsedArtifactResponse | null {
  const trimmedContent = params.content.trim();
  if (!trimmedContent) {
    return null;
  }

  const explicitArtifactRequest =
    /\bartifact\b/i.test(params.userMessage) ||
    /\b(as|into)\s+an?\s+artifact\b/i.test(params.userMessage);
  const componentIntent =
    /\b(component|widget|ui|page|app|react|tsx|jsx)\b/i.test(
      params.userMessage
    );
  const fencedMatch = trimmedContent.match(
    /^```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```(?:\s*[\r\n]+([\s\S]*))?$/
  );

  if (fencedMatch) {
    const language = (fencedMatch[1] ?? "text").toLowerCase();
    const fileContent = fencedMatch[2].trim();
    const trailingText = fencedMatch[3]?.trim() ?? "";
    const intro =
      trailingText && !/saved as an artifact|artifact file/i.test(trailingText)
        ? trailingText
        : "";

    if (
      explicitArtifactRequest ||
      (params.artifacts.order.length === 0 && componentIntent)
    ) {
      if (language === "markdown" || language === "md" || language === "csv") {
        const fallback = inferFallbackDocumentPath(fileContent, params.userMessage);

        return buildSyntheticCreateResponse({
          path: pickUniqueArtifactPath(params.artifacts, fallback.path),
          language: fallback.language,
          fileContent,
          intro,
        });
      }

      return buildSyntheticCreateResponse({
        path: pickUniqueArtifactPath(
          params.artifacts,
          inferFallbackCodePath(language, params.userMessage)
        ),
        language,
        fileContent,
        intro,
      });
    }
  }

  const previousUserMessage = [...params.sessionMessages]
    .reverse()
    .find((message) => message.role === "user")?.content;

  if (
    explicitArtifactRequest ||
    /\b(email|document|plan|report|brief|csv|markdown|diagram)\b/i.test(
      previousUserMessage ?? ""
    )
  ) {
    const fallback = inferFallbackDocumentPath(
      trimmedContent,
      previousUserMessage ?? params.userMessage
    );

    return buildSyntheticCreateResponse({
      path: pickUniqueArtifactPath(params.artifacts, fallback.path),
      language: fallback.language,
      fileContent: trimmedContent,
      intro: "Created artifact:",
    });
  }

  return null;
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
    { role: "system", content: buildHarnessToolManifest() },
    ...sessionMessages,
    { role: "user", content: userMessage },
    ...loopMessages,
  ];
}

async function executeToolCalls(
  calls: HarnessToolCall[]
): Promise<HarnessToolResult[]> {
  const response = await fetch("/api/harness", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ calls }),
  });

  if (!response.ok) {
    throw new Error("Failed to execute harness tools.");
  }

  const data = (await response.json()) as { results?: HarnessToolResult[] };
  return Array.isArray(data.results) ? data.results : [];
}

function buildContextResultMessage(params: {
  toolResults: HarnessToolResult[];
  artifactSourceContent?: string;
}): string {
  const sections = [
    "Here is the requested context. You may request more context, or continue to a final response with any artifact edits.",
  ];

  if (params.toolResults.length > 0) {
    sections.push(buildHarnessToolResultsContext(params.toolResults));
  }

  if (params.artifactSourceContent) {
    sections.push(params.artifactSourceContent);
  }

  return sections.join("\n\n");
}

export async function runHarnessAwareTurn({
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
}: RunHarnessTurnParams): Promise<HarnessTurnResult> {
  let workingArtifacts = artifacts;
  const loopMessages: Message[] = [];
  const statsTotals = { tokens: 0, elapsed: 0 };
  let lastProtocolError =
    "The assistant did not produce a valid harness response before the loop limit was reached.";

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

    const parsedArtifacts = parseArtifactResponse(passContent);
    const parsedTools = parseToolCallResponse(passContent);
    const requestDirectives = parsedArtifacts.directives.filter(
      (directive) => directive.kind === "request"
    );
    const editDirectives = parsedArtifacts.directives.filter(
      (directive) => directive.kind === "create" || directive.kind === "replace"
    );
    const toolCalls = parsedTools.directives;
    const strippedContent = stripMachineBlocks(passContent, [
      ...parsedArtifacts.blocks,
      ...parsedTools.blocks,
    ]);
    const fallbackParsed =
      requestDirectives.length === 0 &&
      editDirectives.length === 0 &&
      toolCalls.length === 0
        ? synthesizeArtifactFallback({
            content: passContent,
            userMessage,
            sessionMessages,
            artifacts: workingArtifacts,
          })
        : null;

    assertNotCancelled(isCancelled);

    if (parsedTools.errors.length > 0) {
      lastProtocolError = parsedTools.errors.join(" ");
      onVisibleContent?.("", pass);
      loopMessages.push({ role: "assistant", content: passContent });
      loopMessages.push({
        role: "system",
        content: buildHarnessProtocolError(lastProtocolError),
      });
      continue;
    }

    if (requestDirectives.length > 0 || toolCalls.length > 0) {
      if (editDirectives.length > 0 || fallbackParsed || strippedContent) {
        lastProtocolError =
          "Request-only responses may contain only artifact requests and tool calls.";

        onVisibleContent?.("", pass);
        loopMessages.push({ role: "assistant", content: passContent });
        loopMessages.push({
          role: "system",
          content: buildHarnessProtocolError(lastProtocolError),
        });
        continue;
      }

      const requestedPaths = requestDirectives.map((directive) => directive.path);
      let artifactSourceContent: string | undefined;

      if (requestedPaths.length > 0) {
        const sourceContext = buildArtifactSourceContext(
          workingArtifacts,
          requestedPaths
        );

        if (!sourceContext.ok) {
          lastProtocolError = sourceContext.error;
          onVisibleContent?.("", pass);
          loopMessages.push({ role: "assistant", content: passContent });
          loopMessages.push({
            role: "system",
            content: buildHarnessProtocolError(sourceContext.error),
          });
          continue;
        }

        onStatus?.({
          pass,
          phase: "reading",
          message: `Reading ${requestedPaths.join(", ")}`,
        });

        artifactSourceContent = sourceContext.content;
      }

      let toolResults: HarnessToolResult[] = [];

      if (toolCalls.length > 0) {
        onStatus?.({
          pass,
          phase: "calling-tools",
          message: `Running ${toolCalls
            .map((call) => call.name)
            .join(", ")}`,
        });
        toolResults = await executeToolCalls(toolCalls);
      }

      onVisibleContent?.("", pass);
      loopMessages.push({ role: "assistant", content: passContent });
      loopMessages.push({
        role: "system",
        content: buildContextResultMessage({
          toolResults,
          artifactSourceContent,
        }),
      });
      continue;
    }

    if (editDirectives.length > 0 || fallbackParsed) {
      onStatus?.({
        pass,
        phase: "applying",
        message: "Applying artifact changes",
      });

      const applied = applyArtifactOperations({
        artifacts: workingArtifacts,
        parsed: fallbackParsed ?? parsedArtifacts,
        messageId: assistantMessageId,
      });

      if (!applied.ok) {
        lastProtocolError = applied.error;
        onVisibleContent?.("", pass);
        loopMessages.push({ role: "assistant", content: passContent });
        loopMessages.push({
          role: "system",
          content: buildHarnessProtocolError(applied.error),
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

    onStatus?.(null);

    return {
      content: strippedContent || passContent.trim(),
      artifacts: workingArtifacts,
      changedPaths: [],
    };
  }

  onStatus?.(null);

  return {
    content: `Sorry, I couldn't complete the request.\n\n${lastProtocolError}`,
    artifacts,
    changedPaths: [],
  };
}
