import type { ArtifactRenderRef } from "@/utils/artifact-parser";
import { normalizeArtifactPath } from "@/utils/artifact-apply";
import { parseArtifactResponse, truncateIncompleteArtifactMarkup } from "@/utils/artifact-parser";

interface ParsedMessage {
  reasoning: string | null;
  message: string;
  components: { code: string }[];
  artifactRefs: ArtifactRenderRef[];
}

interface ThinkTagResult {
  reasoning: string | null;
  message: string;
}

function parseThinkTag(content: string): ThinkTagResult {
  if (content.startsWith("<think>")) {
    const endThinkIndex = content.indexOf("</think>");
    if (endThinkIndex !== -1) {
      return {
        reasoning: content.substring(7, endThinkIndex).trim(),
        message: content.substring(endThinkIndex + 8),
      };
    }

    return {
      reasoning: content.substring(7).trim(),
      message: "",
    };
  }

  const thinkIndex = content.indexOf("<think>");
  if (thinkIndex !== -1) {
    const endThinkIndex = content.indexOf("</think>", thinkIndex);
    if (endThinkIndex !== -1) {
      return {
        reasoning: content.substring(thinkIndex + 7, endThinkIndex).trim(),
        message:
          content.substring(0, thinkIndex) + content.substring(endThinkIndex + 8),
      };
    }

    return {
      reasoning: content.substring(thinkIndex + 7).trim(),
      message: content.substring(0, thinkIndex),
    };
  }

  return {
    reasoning: null,
    message: content,
  };
}

function parseArtifactBlocks(content: string): {
  message: string;
  artifactRefs: ArtifactRenderRef[];
} {
  const sanitizedContent = truncateIncompleteArtifactMarkup(content);
  const parsed = parseArtifactResponse(sanitizedContent);

  if (parsed.blocks.length === 0) {
    return {
      message: sanitizedContent,
      artifactRefs: [],
    };
  }

  let cursor = 0;
  let refIndex = 0;
  let message = "";
  const artifactRefs = parsed.blocks
    .filter((block) => block.kind !== "request")
    .map<ArtifactRenderRef>((block) => {
      const kind: ArtifactRenderRef["kind"] =
        block.kind === "ref"
          ? "ref"
          : block.kind === "create"
            ? "create"
            : "replace";

      return {
        kind,
        path: (() => {
          try {
            return normalizeArtifactPath(block.path);
          } catch {
            return block.path;
          }
        })(),
        language: block.language,
      };
    });

  for (const block of parsed.blocks) {
    message += sanitizedContent.slice(cursor, block.start);

    if (block.kind !== "request") {
      message += `<ArtifactRef index="${refIndex}" />`;
      refIndex += 1;
    }

    cursor = block.end;
  }

  message += sanitizedContent.slice(cursor);

  return {
    message,
    artifactRefs,
  };
}

function parseReactComponents(content: string): {
  message: string;
  components: { code: string }[];
} {
  const components: { code: string }[] = [];
  const componentRegex = /```tsx\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  let messageWithoutComponents = "";

  while ((match = componentRegex.exec(content)) !== null) {
    messageWithoutComponents += content.slice(lastIndex, match.index);
    messageWithoutComponents += `<ReactComponent index="${components.length}" />`;
    components.push({ code: match[1] });
    lastIndex = match.index + match[0].length;
  }

  messageWithoutComponents += content.slice(lastIndex);

  return {
    message: messageWithoutComponents,
    components,
  };
}

export function parseMessageContent(content: string): ParsedMessage {
  const { reasoning, message } = parseThinkTag(content);
  const { message: messageWithArtifacts, artifactRefs } = parseArtifactBlocks(message);
  const { message: finalMessage, components } = parseReactComponents(
    messageWithArtifacts
  );

  return {
    reasoning,
    message: finalMessage,
    components,
    artifactRefs,
  };
}
