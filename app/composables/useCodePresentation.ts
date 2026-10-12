import { computed, type ComputedRef, type Ref } from "vue";
import type { CodeSegment, LevelLike } from "../types/debug-game";
import { TILE_CONDITION_NAMES, tileCode } from "../data/tiles";
import {
  formatLevelCode,
  type CodeLanguage,
} from "../utils/codeLanguage";

const tileConditionNames = TILE_CONDITION_NAMES.join("|");
const pythonConditionPattern = new RegExp(`\\b(not\\s+)?(${tileConditionNames})(?=\\s*:)`, "g");
const jsConditionPattern = new RegExp(`\\((!?)(${tileConditionNames})\\)`, "g");

const pythonTokenPattern =
  /\b(def|repeat|if|elif|else|while|not)\b|\b([A-Za-z_][A-Za-z0-9_]*)(?=\()|\b(\d+)\b|[:()]/g;
const jsTokenPattern =
  /\b(function|if|else|while|repeat)\b|\b([A-Za-z_][A-Za-z0-9_]*)(?=\()|\b(\d+)\b|[{}();]/g;

function tokenizeCodeText(
  text: string,
  language: CodeLanguage,
): CodeSegment[] {
  const pattern = language === "js" ? jsTokenPattern : pythonTokenPattern;
  const segments: CodeSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
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

export function parseCodeLineSegments(
  line: string,
  language: CodeLanguage = "python",
): CodeSegment[] {
  const conditionPattern =
    language === "js" ? jsConditionPattern : pythonConditionPattern;
  const segments: CodeSegment[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(conditionPattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push(
        ...tokenizeCodeText(line.slice(lastIndex, index), language),
      );
    }
    segments.push({
      kind: "tile",
      color: tileCode(match[2]!),
      negate: Boolean(match[1]),
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < line.length) {
    segments.push(...tokenizeCodeText(line.slice(lastIndex), language));
  }
  if (!segments.length) {
    segments.push({ kind: "plain", text: line || " " });
  }

  return segments;
}

export function useCodePresentation(
  currentLevel: ComputedRef<LevelLike>,
  codeLanguage: Ref<CodeLanguage> | ComputedRef<CodeLanguage>,
) {
  // Keep all code-view calculations together so the page component can stay
  // focused on gameplay flow instead of typography math.
  const displayCode = computed(() =>
    formatLevelCode(currentLevel.value.code, codeLanguage.value),
  );

  const rawCodeLines = computed(() => displayCode.value.split("\n"));

  const codeLineEntries = computed(() =>
    rawCodeLines.value.map((line, index) => ({
      index,
      line,
      segments: parseCodeLineSegments(line, codeLanguage.value),
    })),
  );

  const codeBoxStyle = computed(() => {
    // Junior note:
    // We scale by both line count and longest line length because a short
    // program should feel large and welcoming, while a long program needs to
    // shrink enough to fit without clipping.
    const lines = rawCodeLines.value.length;
    // A tile condition renders as a swatch + name chip (about 7 characters
    // wide), not as its single letter, so count it at that width.
    const conditionPattern =
      codeLanguage.value === "js" ? jsConditionPattern : pythonConditionPattern;
    const longestLine = rawCodeLines.value.reduce(
      (max, line) =>
        Math.max(max, line.replace(conditionPattern, "       ").length),
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
    displayCode,
    rawCodeLines,
    codeLineEntries,
    codeBoxStyle,
  };
}
