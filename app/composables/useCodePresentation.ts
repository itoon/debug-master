import { computed, type ComputedRef } from "vue";
import type { CodeSegment, LevelLike } from "../types/debug-game";

const conditionColorPattern = /\((!?)([bpgoyvnk])\)/g;
const codeTokenPattern =
  /\b(function|if|else|while|repeat)\b|\b([A-Za-z_][A-Za-z0-9_]*)(?=\()|\b(\d+)\b|[{}();]/g;

function tokenizeCodeText(text: string): CodeSegment[] {
  const segments: CodeSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(codeTokenPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: "plain", text: text.slice(lastIndex, index) });
    }

    const token = match[0];
    if (match[1]) {
      segments.push({ kind: "keyword", text: token });
    } else if (match[2]) {
      segments.push({ kind: "name", text: token });
    } else if (match[3]) {
      segments.push({ kind: "number", text: token });
    } else {
      segments.push({ kind: "punct", text: token });
    }
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "plain", text: text.slice(lastIndex) });
  }

  return segments;
}

export function parseCodeLineSegments(line: string): CodeSegment[] {
  const segments: CodeSegment[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(conditionColorPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(...tokenizeCodeText(line.slice(lastIndex, index)));
    }
    segments.push({ kind: "punct", text: "(" });
    segments.push({ kind: "tile", color: match[2], negate: match[1] === "!" });
    segments.push({ kind: "punct", text: ")" });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push(...tokenizeCodeText(line.slice(lastIndex)));
  }
  if (!segments.length) {
    segments.push({ kind: "plain", text: line || " " });
  }

  return segments;
}

export function useCodePresentation(currentLevel: ComputedRef<LevelLike>) {
  // Keep all code-view calculations together so the page component can stay
  // focused on gameplay flow instead of typography math.
  const rawCodeLines = computed(() => currentLevel.value.code.split("\n"));

  const codeLineEntries = computed(() =>
    rawCodeLines.value.map((line, index) => ({
      index,
      line,
      segments: parseCodeLineSegments(line),
    })),
  );

  const codeBoxStyle = computed(() => {
    // Junior note:
    // We scale by both line count and longest line length because a short
    // program should feel large and welcoming, while a long program needs to
    // shrink enough to fit without clipping.
    const lines = rawCodeLines.value.length;
    const longestLine = rawCodeLines.value.reduce(
      (max, line) => Math.max(max, line.length),
      0,
    );
    const lineFactor = 18 / Math.max(lines, 12);
    const widthFactor = 28 / Math.max(longestLine, 18);
    const fontSize = Math.max(
      0.56,
      Math.min(1.24, Math.min(lineFactor, widthFactor) * 1.08),
    );
    const lineHeight =
      lines > 30 ? 1.08 : lines > 24 ? 1.12 : lines > 18 ? 1.18 : 1.26;

    return {
      "--code-font-size": `${fontSize}rem`,
      "--code-line-height": String(lineHeight),
    };
  });

  return {
    rawCodeLines,
    codeLineEntries,
    codeBoxStyle,
  };
}
