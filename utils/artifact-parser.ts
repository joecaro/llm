import type { ArtifactLanguage } from "@/types/chat";

export interface ArtifactCreateDirective {
  kind: "create";
  path: string;
  language?: string;
  content: string;
}

export interface ArtifactReplaceDirective {
  kind: "replace";
  path: string;
  search: string;
  replace: string;
}

export interface ArtifactRequestDirective {
  kind: "request";
  path: string;
}

export type ArtifactDirective =
  | ArtifactCreateDirective
  | ArtifactReplaceDirective
  | ArtifactRequestDirective;

export interface ArtifactRenderRef {
  kind: "create" | "replace" | "ref";
  path: string;
  language?: ArtifactLanguage;
}

interface ArtifactBlockBase {
  start: number;
  end: number;
  path: string;
  language?: ArtifactLanguage;
}

export interface ArtifactCreateBlock extends ArtifactBlockBase {
  kind: "create";
}

export interface ArtifactReplaceBlock extends ArtifactBlockBase {
  kind: "replace";
}

export interface ArtifactRequestBlock extends ArtifactBlockBase {
  kind: "request";
}

export interface ArtifactRefBlock extends ArtifactBlockBase {
  kind: "ref";
}

export type ArtifactBlock =
  | ArtifactCreateBlock
  | ArtifactReplaceBlock
  | ArtifactRequestBlock
  | ArtifactRefBlock;

export interface ParsedArtifactResponse {
  content: string;
  directives: ArtifactDirective[];
  blocks: ArtifactBlock[];
}

type ArtifactTagKind = "request" | "replace" | "ref" | "create";

const TAGS: Array<{ kind: ArtifactTagKind; token: string }> = [
  { kind: "request", token: "<artifact-request" },
  { kind: "replace", token: "<artifact-replace" },
  { kind: "ref", token: "<artifact-ref" },
  { kind: "create", token: "<artifact" },
];

function stripWrappingNewlines(value: string): string {
  let normalized = value.replace(/\r\n/g, "\n");

  if (normalized.startsWith("\n")) {
    normalized = normalized.slice(1);
  }

  if (normalized.endsWith("\n")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function parseAttributes(openTag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;

  while ((match = attributeRegex.exec(openTag)) !== null) {
    attributes[match[1]] = match[3] ?? match[4] ?? "";
  }

  return attributes;
}

function findNextTag(content: string, fromIndex: number): {
  kind: ArtifactTagKind;
  index: number;
} | null {
  const matches = TAGS.map(({ kind, token }) => ({
    kind,
    index: content.indexOf(token, fromIndex),
    tokenLength: token.length,
  })).filter((candidate) => candidate.index !== -1);

  if (matches.length === 0) {
    return null;
  }

  matches.sort((left, right) => {
    if (left.index !== right.index) {
      return left.index - right.index;
    }

    return right.tokenLength - left.tokenLength;
  });

  return {
    kind: matches[0].kind,
    index: matches[0].index,
  };
}

function extractInnerTag(content: string, tagName: string): string | null {
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;
  const start = content.indexOf(openTag);

  if (start === -1) return null;

  const innerStart = start + openTag.length;
  const end = content.indexOf(closeTag, innerStart);

  if (end === -1) return null;

  return content.slice(innerStart, end);
}

function unwrapTaggedText(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("<![CDATA[") && trimmed.endsWith("]]>")) {
    return stripWrappingNewlines(trimmed.slice(9, -3));
  }

  return stripWrappingNewlines(value);
}

function parseArtifactRequest(
  content: string,
  start: number
): {
  directive: ArtifactRequestDirective;
  block: ArtifactRequestBlock;
} | null {
  const tagEnd = content.indexOf("/>", start);
  if (tagEnd === -1) return null;

  const openTag = content.slice(start, tagEnd + 2);
  const attributes = parseAttributes(openTag);
  const path = attributes.path ?? attributes.title ?? attributes.identifier;
  if (!path) return null;

  return {
    directive: {
      kind: "request",
      path,
    },
    block: {
      kind: "request",
      path,
      start,
      end: tagEnd + 2,
    },
  };
}

function parseArtifactRef(
  content: string,
  start: number
): ArtifactRefBlock | null {
  const tagEnd = content.indexOf("/>", start);
  if (tagEnd === -1) return null;

  const openTag = content.slice(start, tagEnd + 2);
  const attributes = parseAttributes(openTag);
  const path = attributes.path ?? attributes.title ?? attributes.identifier;
  if (!path) return null;

  const language = (attributes.language ?? attributes.type) as
    | ArtifactLanguage
    | undefined;

  return {
    kind: "ref",
    path,
    language,
    start,
    end: tagEnd + 2,
  };
}

function parseArtifactCreate(
  content: string,
  start: number
): {
  directive: ArtifactCreateDirective;
  block: ArtifactCreateBlock;
} | null {
  const openTagEnd = content.indexOf(">", start);
  if (openTagEnd === -1) return null;

  const closeTag = "</artifact>";
  const closeTagStart = content.indexOf(closeTag, openTagEnd + 1);
  if (closeTagStart === -1) return null;

  const openTag = content.slice(start, openTagEnd + 1);
  const attributes = parseAttributes(openTag);
  const path = attributes.path ?? attributes.title ?? attributes.identifier;
  if (!path) return null;

  const body = content.slice(openTagEnd + 1, closeTagStart);

  return {
    directive: {
      kind: "create",
      path,
      language: attributes.language ?? attributes.type,
      content: stripWrappingNewlines(body),
    },
    block: {
      kind: "create",
      path,
      language: (attributes.language ?? attributes.type) as
        | ArtifactLanguage
        | undefined,
      start,
      end: closeTagStart + closeTag.length,
    },
  };
}

function parseArtifactReplace(
  content: string,
  start: number
): {
  directive: ArtifactReplaceDirective;
  block: ArtifactReplaceBlock;
} | null {
  const openTagEnd = content.indexOf(">", start);
  if (openTagEnd === -1) return null;

  const closeTag = "</artifact-replace>";
  const closeTagStart = content.indexOf(closeTag, openTagEnd + 1);
  if (closeTagStart === -1) return null;

  const openTag = content.slice(start, openTagEnd + 1);
  const attributes = parseAttributes(openTag);
  const path = attributes.path ?? attributes.title ?? attributes.identifier;
  if (!path) return null;

  const body = content.slice(openTagEnd + 1, closeTagStart);
  const search = extractInnerTag(body, "search");
  const replace = extractInnerTag(body, "replace");
  if (search === null || replace === null) return null;

  return {
    directive: {
      kind: "replace",
      path,
      search: unwrapTaggedText(search),
      replace: unwrapTaggedText(replace),
    },
    block: {
      kind: "replace",
      path,
      start,
      end: closeTagStart + closeTag.length,
    },
  };
}

function parseFencedArtifacts(content: string): Array<{
  directive: ArtifactDirective;
  block: ArtifactBlock;
}> {
  const results: Array<{
    directive: ArtifactDirective;
    block: ArtifactBlock;
  }> = [];
  const fenceRegex = /```([a-zA-Z0-9]+)[^\n]*\b(?:file|path)=["']([^"']+)["'][^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    const block: ArtifactBlock = {
      kind: "create",
      path: match[2],
      language: match[1] as ArtifactLanguage,
      start: match.index,
      end: match.index + match[0].length,
    };

    results.push({
      directive: {
        kind: "create",
        path: match[2],
        language: match[1],
        content: stripWrappingNewlines(match[3]),
      },
      block,
    });
  }

  return results;
}

export function parseArtifactResponse(content: string): ParsedArtifactResponse {
  const directiveEntries: Array<{
    start: number;
    directive: ArtifactDirective;
  }> = [];
  const blocks: ArtifactBlock[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const nextTag = findNextTag(content, cursor);
    if (!nextTag) break;

    let parsed:
      | {
          directive: ArtifactDirective;
          block: ArtifactBlock;
        }
      | ArtifactRefBlock
      | null = null;

    if (nextTag.kind === "request") {
      parsed = parseArtifactRequest(content, nextTag.index);
    } else if (nextTag.kind === "replace") {
      parsed = parseArtifactReplace(content, nextTag.index);
    } else if (nextTag.kind === "ref") {
      parsed = parseArtifactRef(content, nextTag.index);
    } else {
      parsed = parseArtifactCreate(content, nextTag.index);
    }

    if (!parsed) {
      cursor = nextTag.index + 1;
      continue;
    }

    if ("directive" in parsed) {
      directiveEntries.push({
        start: parsed.block.start,
        directive: parsed.directive,
      });
      blocks.push(parsed.block);
      cursor = parsed.block.end;
      continue;
    }

    blocks.push(parsed);
    cursor = parsed.end;
  }

  const fencedArtifacts = parseFencedArtifacts(content);

  for (const artifact of fencedArtifacts) {
    directiveEntries.push({
      start: artifact.block.start,
      directive: artifact.directive,
    });
    blocks.push(artifact.block);
  }

  return {
    content,
    directives: directiveEntries
      .sort((left, right) => left.start - right.start)
      .map((entry) => entry.directive),
    blocks: blocks.sort(
      (left, right) => left.start - right.start
    ),
  };
}
