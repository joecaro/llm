import type {
  ArtifactLanguage,
  ChatArtifactFile,
  ChatArtifacts,
} from "@/types/chat";
import { createEmptyArtifacts } from "@/utils/create-empty-chat";
import type {
  ArtifactCreateDirective,
  ArtifactDirective,
  ArtifactRenderRef,
  ArtifactReplaceDirective,
  ParsedArtifactResponse,
} from "@/utils/artifact-parser";

const EXTENSION_TO_LANGUAGE: Record<string, ArtifactLanguage> = {
  css: "css",
  html: "html",
  js: "js",
  json: "json",
  jsx: "jsx",
  ts: "ts",
  tsx: "tsx",
};

export function normalizeArtifactPath(rawPath: string): string {
  const normalized = rawPath.trim().replace(/\\/g, "/").replace(/\/+/g, "/");

  if (!normalized) {
    throw new Error("Artifact path cannot be empty.");
  }

  if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Artifact path "${rawPath}" must be relative.`);
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new Error(`Artifact path "${rawPath}" cannot include "..".`);
  }

  if (segments.some((segment) => segment.trim() === "" || segment === ".")) {
    throw new Error(`Artifact path "${rawPath}" is invalid.`);
  }

  return normalized;
}

export function inferArtifactLanguage(
  path: string,
  explicitLanguage?: string | null
): ArtifactLanguage {
  const hintedLanguage = explicitLanguage?.trim().toLowerCase() as
    | ArtifactLanguage
    | undefined;

  if (
    hintedLanguage &&
    ["tsx", "jsx", "css", "js", "ts", "html", "json", "text"].includes(
      hintedLanguage
    )
  ) {
    return hintedLanguage;
  }

  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension) return "text";

  return EXTENSION_TO_LANGUAGE[extension] ?? "text";
}

export function isArtifactPreviewable(language: ArtifactLanguage): boolean {
  return language === "tsx" || language === "jsx" || language === "html";
}

export function getArtifactCssBundle(artifacts: ChatArtifacts): string {
  return artifacts.order
    .map((path) => artifacts.files[path])
    .filter((file): file is ChatArtifactFile => Boolean(file))
    .filter((file) => file.language === "css")
    .map((file) => file.content)
    .join("\n\n");
}

function countMatches(content: string, search: string): number {
  if (!search) return 0;

  let count = 0;
  let index = 0;

  while (index <= content.length) {
    const matchIndex = content.indexOf(search, index);
    if (matchIndex === -1) break;
    count += 1;
    index = matchIndex + search.length;
  }

  return count;
}

function cloneArtifacts(artifacts: ChatArtifacts): ChatArtifacts {
  return {
    files: Object.fromEntries(
      Object.entries(artifacts.files).map(([path, file]) => [path, { ...file }])
    ),
    order: [...artifacts.order],
  };
}

function createRenderRefs(
  parsed: ParsedArtifactResponse
): ArtifactRenderRef[] {
  return parsed.blocks
    .filter((block) => block.kind !== "request")
    .map((block) => ({
      kind: block.kind === "ref" ? "ref" : block.kind,
      path: (() => {
        try {
          return normalizeArtifactPath(block.path);
        } catch {
          return block.path;
        }
      })(),
      language: block.language,
    }));
}

export interface ArtifactApplySuccess {
  ok: true;
  artifacts: ChatArtifacts;
  changedPaths: string[];
  sanitizedContent: string;
  artifactRefs: ArtifactRenderRef[];
}

export interface ArtifactApplyFailure {
  ok: false;
  error: string;
}

export type ArtifactApplyResult = ArtifactApplySuccess | ArtifactApplyFailure;

function applyCreateDirective(
  fileMap: ChatArtifacts["files"],
  order: string[],
  directive: ArtifactCreateDirective,
  messageId: string,
  timestamp: number
): string {
  const path = normalizeArtifactPath(directive.path);

  if (fileMap[path]) {
    throw new Error(`Cannot create "${path}" because it already exists.`);
  }

  fileMap[path] = {
    path,
    language: inferArtifactLanguage(path, directive.language),
    content: directive.content,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByMessageId: messageId,
    updatedByMessageId: messageId,
  };

  if (!order.includes(path)) {
    order.push(path);
  }

  return path;
}

function applyReplaceDirective(
  fileMap: ChatArtifacts["files"],
  directive: ArtifactReplaceDirective,
  messageId: string,
  timestamp: number
): string {
  const path = normalizeArtifactPath(directive.path);
  const file = fileMap[path];

  if (!file) {
    throw new Error(`Cannot update "${path}" because it does not exist.`);
  }

  if (!directive.search) {
    throw new Error(`Cannot update "${path}" because the search text is empty.`);
  }

  const matchCount = countMatches(file.content, directive.search);

  if (matchCount === 0) {
    throw new Error(
      `Cannot update "${path}" because the search text matched 0 times.`
    );
  }

  if (matchCount > 1) {
    throw new Error(
      `Cannot update "${path}" because the search text matched ${matchCount} times.`
    );
  }

  fileMap[path] = {
    ...file,
    content: file.content.replace(directive.search, directive.replace),
    updatedAt: timestamp,
    updatedByMessageId: messageId,
  };

  return path;
}

function sanitizeArtifactMessage(
  content: string,
  parsed: ParsedArtifactResponse
): { sanitizedContent: string; artifactRefs: ArtifactRenderRef[] } {
  const refs = createRenderRefs(parsed);

  if (parsed.blocks.length === 0) {
    return {
      sanitizedContent: content.trim(),
      artifactRefs: refs,
    };
  }

  let cursor = 0;
  let sanitizedContent = "";
  let refIndex = 0;

  for (const block of parsed.blocks) {
    sanitizedContent += content.slice(cursor, block.start);

    if (block.kind !== "request") {
      const normalizedPath = (() => {
        try {
          return normalizeArtifactPath(block.path);
        } catch {
          return block.path;
        }
      })();
      sanitizedContent += `\n\n<artifact-ref path="${normalizedPath}" />\n\n`;
      refIndex += 1;
    }

    cursor = block.end;
  }

  sanitizedContent += content.slice(cursor);

  const trimmed = sanitizedContent.trim();
  if (trimmed) {
    return {
      sanitizedContent: trimmed,
      artifactRefs: refs,
    };
  }

  if (refIndex === 0) {
    return {
      sanitizedContent: "",
      artifactRefs: refs,
    };
  }

  const synthesizedRefs = refs
    .map((ref) => `<artifact-ref path="${ref.path}" />`)
    .join("\n\n");

  return {
    sanitizedContent: `Updated artifacts:\n\n${synthesizedRefs}`,
    artifactRefs: refs,
  };
}

export function applyArtifactOperations(params: {
  artifacts: ChatArtifacts;
  parsed: ParsedArtifactResponse;
  messageId: string;
  timestamp?: number;
}): ArtifactApplyResult {
  const directives = params.parsed.directives.filter(
    (directive): directive is Exclude<ArtifactDirective, { kind: "request" }> =>
      directive.kind !== "request"
  );

  if (directives.length === 0) {
    const sanitized = sanitizeArtifactMessage(params.parsed.content, params.parsed);
    return {
      ok: true,
      artifacts: params.artifacts,
      changedPaths: [],
      sanitizedContent: sanitized.sanitizedContent,
      artifactRefs: sanitized.artifactRefs,
    };
  }

  const nextArtifacts = cloneArtifacts(params.artifacts ?? createEmptyArtifacts());
  const changedPaths: string[] = [];
  const timestamp = params.timestamp ?? Date.now();

  try {
    for (const directive of directives) {
      let changedPath = "";

      if (directive.kind === "create") {
        changedPath = applyCreateDirective(
          nextArtifacts.files,
          nextArtifacts.order,
          directive,
          params.messageId,
          timestamp
        );
      } else if (directive.kind === "replace") {
        changedPath = applyReplaceDirective(
          nextArtifacts.files,
          directive,
          params.messageId,
          timestamp
        );
      }

      if (changedPath && !changedPaths.includes(changedPath)) {
        changedPaths.push(changedPath);
      }
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to apply artifact operations.",
    };
  }

  const sanitized = sanitizeArtifactMessage(params.parsed.content, params.parsed);

  return {
    ok: true,
    artifacts: nextArtifacts,
    changedPaths,
    sanitizedContent: sanitized.sanitizedContent,
    artifactRefs: sanitized.artifactRefs,
  };
}
