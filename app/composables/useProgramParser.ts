import type { Condition, Direction, IfNode, Node, Program } from "../types/debug-game";

export const MOVE_NAMES = new Set(["up", "down", "left", "right"]);

function tokenize(code: string): string[] {
  return code.match(/[A-Za-z_][A-Za-z0-9_]*|\d+|[(){};!]/g) ?? [];
}

export function useProgramParser(getLevelId: () => number) {
  function parseProgram(code: string): Program {
    const tokens = tokenize(code);
    let index = 0;
    let id = 0;
    const functions: Record<string, Node[]> = {};

    const nextId = (prefix: string) => `${getLevelId()}-${prefix}-${id++}`;
    const peek = () => tokens[index];
    const take = () => tokens[index++];
    const accept = (token: string) =>
      peek() === token ? ((index += 1), true) : false;

    const expect = (token: string) => {
      if (!accept(token)) {
        throw new Error(`Expected ${token}, got ${peek() ?? "end"}`);
      }
    };

    const parseCondition = (): Condition => {
      expect("(");
      const negate = accept("!");
      const color = take();
      expect(")");
      return { color, negate };
    };

    const parseBlock = (): Node[] => {
      expect("{");
      const body = parseStatements(true);
      expect("}");
      return body;
    };

    const parseIf = (): IfNode => {
      expect("if");
      const condition = parseCondition();
      const body = parseBlock();
      let elseBody: Node[] = [];

      if (accept("else")) {
        elseBody = peek() === "if" ? [parseIf()] : parseBlock();
      }

      return { id: nextId("if"), type: "if", condition, body, elseBody };
    };

    const parseStatement = (): Node | null => {
      const token = peek();
      if (!token || token === "}") return null;

      // Junior note:
      // Function declarations do not become runtime nodes in the main list.
      // We store them in a lookup table first, then call them later by name.
      if (token === "function") {
        take();
        const name = take();
        expect("(");
        expect(")");
        functions[name] = parseBlock();
        return null;
      }

      if (token === "if") return parseIf();

      if (token === "repeat") {
        take();
        expect("(");
        const count = Number(take());
        expect(")");
        return {
          id: nextId("repeat"),
          type: "repeat",
          count,
          body: parseBlock(),
        };
      }

      if (token === "while") {
        take();
        const condition = parseCondition();
        return {
          id: nextId("while"),
          type: "while",
          condition,
          body: parseBlock(),
        };
      }

      const name = take();
      expect("(");
      expect(")");
      accept(";");

      if (MOVE_NAMES.has(name)) {
        return {
          id: nextId("move"),
          type: "move",
          direction: name as Direction,
        };
      }

      return { id: nextId("call"), type: "call", name };
    };

    const parseStatements = (stopOnBrace: boolean): Node[] => {
      const nodes: Node[] = [];
      while (index < tokens.length && (!stopOnBrace || peek() !== "}")) {
        const statement = parseStatement();
        if (statement) nodes.push(statement);
      }
      return nodes;
    };

    return {
      main: parseStatements(false),
      functions,
    };
  }

  return {
    parseProgram,
  };
}
