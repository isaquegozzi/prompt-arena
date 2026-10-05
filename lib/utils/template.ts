/**
 * Variable substitution for prompts.
 * Variables use the {{name}} mustache-like syntax.
 */

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function extractVariables(prompt: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  VARIABLE_RE.lastIndex = 0;
  while ((match = VARIABLE_RE.exec(prompt)) !== null) {
    if (match[1]) found.add(match[1]);
  }
  return Array.from(found);
}

export function substituteVariables(
  prompt: string,
  values: Record<string, string>,
): { result: string; missing: string[] } {
  const missing: string[] = [];
  const result = prompt.replace(VARIABLE_RE, (match, name: string) => {
    const value = values[name];
    if (!value || value.trim() === '') {
      missing.push(name);
      return match;
    }
    return value;
  });
  return { result, missing: Array.from(new Set(missing)) };
}