export interface ToolCallDirective {
  kind: "tool";
  name: string;
  input: Record<string, unknown>;
}

export interface ToolCallBlock {
  kind: "tool";
  name: string;
  start: number;
  end: number;
}

export interface ParsedToolCallResponse {
  directives: ToolCallDirective[];
  blocks: ToolCallBlock[];
  errors: string[];
  hasMarkup: boolean;
}

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

function unwrapTaggedText(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("<![CDATA[") && trimmed.endsWith("]]>")) {
    return stripWrappingNewlines(trimmed.slice(9, -3));
  }

  return stripWrappingNewlines(value);
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

export function parseToolCallResponse(content: string): ParsedToolCallResponse {
  const directives: ToolCallDirective[] = [];
  const blocks: ToolCallBlock[] = [];
  const errors: string[] = [];
  const hasMarkup = content.includes("<tool-call");
  const closeTag = "</tool-call>";
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf("<tool-call", cursor);
    if (start === -1) break;

    const openTagEnd = content.indexOf(">", start);
    if (openTagEnd === -1) {
      errors.push("A tool call is missing its closing `>`.");
      break;
    }

    const openTag = content.slice(start, openTagEnd + 1);
    const attributes = parseAttributes(openTag);
    const name = attributes.name ?? attributes.tool;
    const selfClosing = /\/>\s*$/.test(openTag);

    if (selfClosing) {
      if (!name) {
        errors.push("A self-closing tool call is missing its `name` attribute.");
      } else {
        directives.push({
          kind: "tool",
          name,
          input: {},
        });
      }

      blocks.push({
        kind: "tool",
        name: name ?? "unknown",
        start,
        end: openTagEnd + 1,
      });
      cursor = openTagEnd + 1;
      continue;
    }

    const closeTagStart = content.indexOf(closeTag, openTagEnd + 1);
    if (closeTagStart === -1) {
      errors.push(
        name
          ? `The tool call "${name}" is missing a closing \`</tool-call>\` tag.`
          : "A tool call is missing a closing `</tool-call>` tag."
      );
      break;
    }

    const rawBody = content.slice(openTagEnd + 1, closeTagStart);
    const inputText = unwrapTaggedText(rawBody).trim();
    const end = closeTagStart + closeTag.length;

    blocks.push({
      kind: "tool",
      name: name ?? "unknown",
      start,
      end,
    });

    if (!name) {
      errors.push("A tool call is missing its `name` attribute.");
      cursor = end;
      continue;
    }

    if (!inputText) {
      directives.push({
        kind: "tool",
        name,
        input: {},
      });
      cursor = end;
      continue;
    }

    try {
      const parsed = JSON.parse(inputText);

      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        errors.push(`The tool call "${name}" must contain a JSON object body.`);
      } else {
        directives.push({
          kind: "tool",
          name,
          input: parsed as Record<string, unknown>,
        });
      }
    } catch {
      errors.push(`The tool call "${name}" must contain valid JSON.`);
    }

    cursor = end;
  }

  return {
    directives,
    blocks,
    errors,
    hasMarkup,
  };
}
