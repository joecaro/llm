import type { ArtifactLanguage, Message } from "@/types/chat";
import type { ChatArtifacts } from "@/types/chat";
import { streamCompletion, type StreamStats } from "@/fetches/completion";
import { inferReportBundlePaths, REPORT_BUNDLE_INTENT_RE } from "@/lib/report-bundles";
import { applyArtifactOperations } from "@/utils/artifact-apply";
import { buildArtifactManifest, buildArtifactProtocolError, buildArtifactSourceContext } from "@/utils/artifact-context";
import type { ParsedArtifactResponse } from "@/utils/artifact-parser";
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

function inferFallbackDocumentPath(
  content: string,
  userMessage: string
): string {
  const lowerContent = content.toLowerCase();
  const lowerUserMessage = userMessage.toLowerCase();

  if (
    /\bsubject:\s*/i.test(content) ||
    /\bdear\s+\[?.+?\]?,/i.test(content) ||
    lowerUserMessage.includes("email")
  ) {
    return "drafts/email.md";
  }

  if (/\b(plan|brief|roadmap)\b/.test(lowerUserMessage)) {
    return "docs/plan.md";
  }

  if (REPORT_BUNDLE_INTENT_RE.test(userMessage)) {
    return inferReportBundlePaths(userMessage).reportPath;
  }

  if (lowerContent.includes("# ") || lowerContent.includes("## ")) {
    return "docs/document.md";
  }

  return "docs/draft.md";
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
  const fencedMatch = trimmedContent.match(/^```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```(?:\s*[\r\n]+([\s\S]*))?$/);

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
      const basePath =
        language === "markdown" || language === "md"
          ? inferFallbackDocumentPath(fileContent, params.userMessage)
          : inferFallbackCodePath(language, params.userMessage);

      return buildSyntheticCreateResponse({
        path: pickUniqueArtifactPath(params.artifacts, basePath),
        language:
          language === "markdown" || language === "md" ? "text" : language,
        fileContent,
        intro,
      });
    }
  }

  const previousUserMessage = [...params.sessionMessages]
    .reverse()
    .find((message) => message.role === "user")?.content;
  const reportIntent = REPORT_BUNDLE_INTENT_RE.test(
    previousUserMessage ?? params.userMessage
  );

  if (
    explicitArtifactRequest ||
    reportIntent ||
    /\bemail|document|plan|brief\b/i.test(previousUserMessage ?? "")
  ) {
    return buildSyntheticCreateResponse({
      path: pickUniqueArtifactPath(
        params.artifacts,
        inferFallbackDocumentPath(trimmedContent, previousUserMessage ?? params.userMessage)
      ),
      language: "text",
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
    const fallbackParsed =
      requestDirectives.length === 0 && editDirectives.length === 0
        ? synthesizeArtifactFallback({
            content: passContent,
            userMessage,
            sessionMessages,
            artifacts: workingArtifacts,
          })
        : null;

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

    if (editDirectives.length > 0 || fallbackParsed) {
      onStatus?.({
        pass,
        phase: "applying",
        message: "Applying artifact changes",
      });

      const applied = applyArtifactOperations({
        artifacts: workingArtifacts,
        parsed: fallbackParsed ?? parsed,
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
