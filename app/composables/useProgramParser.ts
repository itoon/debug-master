import type { Condition, Direction, IfNode, Node, Program } from "../types/debug-game";
import { tileCode } from "../data/tiles";

export const MOVE_NAMES = new Set(["up", "down", "left", "right"]);

type SourceLine = {
  indent: number;
  text: string;
  number: number;
};

function getSourceLines(code: string): SourceLine[] {
  return code
    .split("\n")
    .map((raw, index) => {
      const match = raw.match(/^(\s*)(.*)$/);
      const indentText = match?.[1] ?? "";
      const text = (match?.[2] ?? "").trimEnd();
      return {
        indent: indentText.replace(/\t/g, "  ").length,
        text,
        number: index + 1,
      };
    })
    .filter((line) => line.text.length > 0);
}

function parseConditionText(raw: string): Condition {
  const text = raw.trim();
  if (text.startsWith("not ")) {
    return { color: tileCode(text.slice(4).trim()), negate: true };
  }
  return { color: tileCode(text), negate: false };
}

export function useProgramParser(getLevelId: () => number) {
  function parseProgram(code: string): Program {
    const lines = getSourceLines(code);
    let index = 0;
    let id = 0;
    const functions: Record<string, Node[]> = {};

    const nextId = (prefix: string) => `${getLevelId()}-${prefix}-${id++}`;
    const peek = () => lines[index];
    const take = () => lines[index++];

    const parseBlock = (parentIndent: number): Node[] => {
      if (!peek() || peek().indent <= parentIndent) return [];
      const blockIndent = peek().indent;
      const nodes: Node[] = [];
      while (peek() && peek().indent === blockIndent) {
        const statement = parseStatement();
        if (statement) nodes.push(statement);
      }
      return nodes;
    };

    const parseIfFromLine = (line: SourceLine, keyword: "if" | "elif"): IfNode => {
      const match = line.text.match(
        new RegExp(`^${keyword}\\s+(.+):\\s*$`),
      );
      if (!match) {
        throw new Error(`Invalid ${keyword} on line ${line.number}`);
      }

      const condition = parseConditionText(match[1]);
      const body = parseBlock(line.indent);
      let elseBody: Node[] = [];

      const next = peek();
      if (next && next.indent === line.indent) {
        if (/^elif\s+/.test(next.text)) {
          take();
          elseBody = [parseIfFromLine(next, "elif")];
        } else if (/^else\s*:\s*$/.test(next.text)) {
          take();
          elseBody = parseBlock(line.indent);
        }
      }

      return {
        id: nextId("if"),
        type: "if",
        condition,
        body,
        elseBody,
      };
    };

    const parseStatement = (): Node | null => {
      const line = peek();
      if (!line) return null;
      take();

      // Junior note:
      // Function declarations do not become runtime nodes in the main list.
      // We store them in a lookup table first, then call them later by name.
      const defMatch = line.text.match(
        /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)\s*:\s*$/,
      );
      if (defMatch) {
        functions[defMatch[1]] = parseBlock(line.indent);
        return null;
      }

      if (/^if\s+/.test(line.text)) {
        return parseIfFromLine(line, "if");
      }

      const repeatMatch = line.text.match(
        /^repeat\s*\(\s*(\d+)\s*\)\s*:\s*$/,
      );
      if (repeatMatch) {
        return {
          id: nextId("repeat"),
          type: "repeat",
          count: Number(repeatMatch[1]),
          body: parseBlock(line.indent),
        };
      }

      const whileMatch = line.text.match(/^while\s+(.+):\s*$/);
      if (whileMatch) {
        return {
          id: nextId("while"),
          type: "while",
          condition: parseConditionText(whileMatch[1]),
          body: parseBlock(line.indent),
        };
      }

      if (/^else\s*:\s*$/.test(line.text) || /^elif\s+/.test(line.text)) {
        throw new Error(`Unexpected ${line.text} on line ${line.number}`);
      }

      const callMatch = line.text.match(
        /^([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)\s*$/,
      );
      if (!callMatch) {
        throw new Error(`Unexpected statement on line ${line.number}: ${line.text}`);
      }

      const name = callMatch[1];
      if (MOVE_NAMES.has(name)) {
        return {
          id: nextId("move"),
          type: "move",
          direction: name as Direction,
        };
      }

      return { id: nextId("call"), type: "call", name };
    };

    const main: Node[] = [];
    while (peek()) {
      if (peek().indent !== 0) {
        throw new Error(
          `Unexpected indent on line ${peek().number}: ${peek().text}`,
        );
      }
      const statement = parseStatement();
      if (statement) main.push(statement);
    }

    return { main, functions };
  }

  return {
    parseProgram,
  };
}
