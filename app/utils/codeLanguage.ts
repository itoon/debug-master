export type CodeLanguage = "python" | "js";

export const CODE_LANGUAGE_OPTIONS: {
  id: CodeLanguage;
  title: string;
  description: string;
}[] = [
  {
    id: "python",
    title: "Python",
    description: "ใช้ indent, def, elif, not เช่น repeat(3):",
  },
  {
    id: "js",
    title: "JavaScript",
    description: "ใช้ {}, function, else if, ! เช่น repeat(3) {",
  },
];

/**
 * Levels are stored in Python form. Convert to the selected display language.
 * Gameplay always parses the stored Python source so both modes stay in sync.
 */
export function formatLevelCode(
  code: string,
  language: CodeLanguage,
): string {
  return language === "js" ? pythonToJs(code) : code;
}

function convertCondition(raw: string): string {
  const text = raw.trim();
  if (text.startsWith("not ")) {
    return `!${text.slice(4).trim()}`;
  }
  return text;
}

export function pythonToJs(code: string): string {
  const lines = code.split("\n");
  const out: string[] = [];
  const indentStack: number[] = [0];

  const closeTo = (indent: number) => {
    while (indentStack.length > 1 && indentStack[indentStack.length - 1]! > indent) {
      while (out.length && out[out.length - 1] === "") out.pop();
      indentStack.pop();
      const closeIndent = " ".repeat(indentStack[indentStack.length - 1]!);
      out.push(`${closeIndent}}`);
    }
  };

  const pushBlockOpen = (indent: number, text: string) => {
    out.push(`${" ".repeat(indent)}${text}`);
    indentStack.push(indent + 2);
  };

  for (const line of lines) {
    if (!line.trim()) {
      out.push("");
      continue;
    }

    const indent = (line.match(/^(\s*)/)?.[1] ?? "").length;
    const text = line.trim();
    closeTo(indent);

    let match: RegExpMatchArray | null;

    if ((match = text.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)\s*:\s*$/))) {
      pushBlockOpen(indent, `function ${match[1]}() {`);
      continue;
    }

    if ((match = text.match(/^repeat\s*\(\s*(\d+)\s*\)\s*:\s*$/))) {
      pushBlockOpen(indent, `repeat(${match[1]}) {`);
      continue;
    }

    if ((match = text.match(/^while\s+(.+):\s*$/))) {
      pushBlockOpen(indent, `while (${convertCondition(match[1])}) {`);
      continue;
    }

    if ((match = text.match(/^if\s+(.+):\s*$/))) {
      pushBlockOpen(indent, `if (${convertCondition(match[1])}) {`);
      continue;
    }

    if ((match = text.match(/^elif\s+(.+):\s*$/))) {
      if (out.length && out[out.length - 1]!.trim() === "}") out.pop();
      pushBlockOpen(
        indent,
        `} else if (${convertCondition(match[1])}) {`,
      );
      continue;
    }

    if (/^else\s*:\s*$/.test(text)) {
      if (out.length && out[out.length - 1]!.trim() === "}") out.pop();
      pushBlockOpen(indent, "} else {");
      continue;
    }

    if ((match = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)\s*$/))) {
      out.push(`${" ".repeat(indent)}${match[1]}();`);
      continue;
    }

    throw new Error(`Cannot convert to JS: ${text}`);
  }

  closeTo(0);

  while (out.length && out[out.length - 1] === "") out.pop();
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
