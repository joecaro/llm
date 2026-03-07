export class Parser {
  private parsers: Record<string, RegExp> = {};

  addParser(name: string, regex: RegExp) {
    this.parsers[name] = regex;
  }

  parse(content: string): { [key: string]: any }[] {
    const inputMessage = content.trim();
    if (!inputMessage) return [];

    const messages: { [key: string]: any }[] = [];

    for (const name in this.parsers) {
      const match = inputMessage.match(this.parsers[name]);
      if (match) {
        // Assuming message format is <name> - <message>
        messages.push({
          type: name,
          value: inputMessage,
          subMessage: match[0],
        });
      }
    }

    return messages;
  }
}

export class CodingParser extends Parser {
  private codingRegex = /<code>(.*?)<\/code>/g;
  private commentedCodeRegex = /\{\{ coding (.*?) \}\}/g;

  constructor() {
    super();
    this.addParser("coding", this.codingRegex);
    this.addParser("commented code", this.commentedCodeRegex);
  }

  parse(content: string): { [key: string]: any }[] {
    const codingMatch = content.match(this.codingRegex);
    if (codingMatch) {
      return [{
        type: "coding",
        value: `<code>${content.replace(codingMatch[1] ?? "", "")}</code>`,
        reasoning: `/* ${content.substring(8)} */`,
      }];
    }

    const commentedMatch = content.match(this.commentedCodeRegex);
    if (commentedMatch) {
      return [{
        type: "commented code",
        value: `<code>${content.replace(commentedMatch[1] ?? "", "")}</code>`,
        reasoning: `/* ${content.substring(11)} */`,
      }];
    }

    console.error("Invalid content");
    return [];
  }
}