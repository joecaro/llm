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
  constructor() {
    super();
    this.addParser("coding", /<code>(.*?)<\/code>/g);
    this.addParser("commented code", /\{\{ coding (.*?) \}\}/g);
  }

  parse(content: string): any {
    const match = content.match(this.parsers["coding"][0]);
    if (match) {
      return {
        type: "coding",
        value: `<code>${content.replace(match[1], "")}</code>`,
        reasoning: `/* ${content.substring(8)} */`, // 8 is the length of '<code>'
      };
    } else if (match = content.match(this.parsers["commented code"][0])) {
      return {
        type: "commented code",
        value: `<code>${content.replace(match[1], "")}</code>`,
        reasoning: `/* ${content.substring(11)} */`, // 11 is the length of '<{'
      };
    } else {
      console.error("Invalid content");
      return null;
    }
  }
}