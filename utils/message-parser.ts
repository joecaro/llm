interface ParsedMessage {
  reasoning: string | null;
  message: string;
  components: { code: string }[];
}

interface ThinkTagResult {
  reasoning: string | null;
  message: string;
}

function parseThinkTag(content: string): ThinkTagResult {
  // Handle think tag at start
  if (content.startsWith('<think>')) {
    const endThinkIndex = content.indexOf('</think>');
    if (endThinkIndex !== -1) {
      return {
        reasoning: content.substring(7, endThinkIndex).trim(),
        message: content.substring(endThinkIndex + 8)
      };
    }
    return {
      reasoning: content.substring(7).trim(),
      message: ''
    };
  }

  // Handle think tag in middle
  const thinkIndex = content.indexOf('<think>');
  if (thinkIndex !== -1) {
    const endThinkIndex = content.indexOf('</think>', thinkIndex);
    if (endThinkIndex !== -1) {
      return {
        reasoning: content.substring(thinkIndex + 7, endThinkIndex).trim(),
        message: content.substring(0, thinkIndex) + content.substring(endThinkIndex + 8)
      };
    }
    return {
      reasoning: content.substring(thinkIndex + 7).trim(),
      message: content.substring(0, thinkIndex)
    };
  }

  return {
    reasoning: null,
    message: content
  };
}

function parseReactComponents(content: string): { message: string; components: { code: string }[] } {
  const components: { code: string }[] = [];
  const componentRegex = /```tsx\n([\s\S]*?)```/g;
  let match;
  let lastIndex = 0;
  let messageWithoutComponents = '';

  while ((match = componentRegex.exec(content)) !== null) {
    messageWithoutComponents += content.slice(lastIndex, match.index);
    messageWithoutComponents += `<ReactComponent index="${components.length}" />`;
    components.push({ code: match[1] });
    lastIndex = match.index + match[0].length;
  }
  messageWithoutComponents += content.slice(lastIndex);

  return {
    message: messageWithoutComponents,
    components
  };
}

export function parseMessageContent(content: string): ParsedMessage {
  // First parse think tags
  const { reasoning, message } = parseThinkTag(content);
  
  // Then parse React components from the resulting message
  const { message: finalMessage, components } = parseReactComponents(message);

  return {
    reasoning,
    message: finalMessage,
    components
  };
} 