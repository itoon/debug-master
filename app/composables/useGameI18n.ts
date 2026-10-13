import { th, type MessageKey } from "../i18n/messages";

// Small host boundary: Step 2 can replace this composable with the course i18n.
// No browser storage or gameplay dependencies. Thai is the default dictionary.
export function useGameI18n() {
  function t(key: MessageKey, values: Record<string, string | number> = {}): string {
    return th[key].replace(/\{(\w+)\}/g, (token, name: string) =>
      values[name] === undefined ? token : String(values[name]),
    );
  }
  return { t, locale: "th" as const };
}
