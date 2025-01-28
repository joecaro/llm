export function parseMessageContent(content: string) {
  // If content starts with <think>, everything until we find </think> or end is reasoning
  if (content.startsWith('<think>')) {
    const endThinkIndex = content.indexOf('</think>');
    if (endThinkIndex !== -1) {
      // Complete think tag - preserve original whitespace and formatting
      return {
        reasoning: content.substring(7, endThinkIndex).trim(),
        message: content.substring(endThinkIndex + 8)  // Remove trim() to preserve formatting
      };
    } else {
      // Still streaming think section
      return {
        reasoning: content.substring(7).trim(),
        message: ''
      };
    }
  }
  
  // If <think> appears in the middle
  const thinkIndex = content.indexOf('<think>');
  if (thinkIndex !== -1) {
    const endThinkIndex = content.indexOf('</think>', thinkIndex);
    if (endThinkIndex !== -1) {
      // Complete think tag in the middle - preserve original whitespace
      return {
        reasoning: content.substring(thinkIndex + 7, endThinkIndex).trim(),
        message: content.substring(0, thinkIndex) + content.substring(endThinkIndex + 8)
      };
    } else {
      // Incomplete think tag
      return {
        reasoning: content.substring(thinkIndex + 7).trim(),
        message: content.substring(0, thinkIndex)
      };
    }
  }
  
  // No think tag - return original content without modification
  return {
    reasoning: null,
    message: content
  };
} 