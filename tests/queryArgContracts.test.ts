import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Convex rejects a call that carries an argument its validator does not declare,
 * and that failure only appears at runtime on the screen that made the call.
 * This walks the real `useQuery(api.module.fn, { ... })` call sites and checks
 * every key against the deployed validator, so a screen and its query cannot
 * drift apart again.
 */
const root = path.resolve(__dirname, "..");
const roots = ["app", "components"].map((dir) => path.join(root, dir));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** Read a brace-balanced object literal starting at `start`, ignoring strings. */
function objectLiteralAt(source: string, start: number): string | null {
  if (source[start] !== "{") return null;
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

/** Top-level keys only; nested objects and arrays are skipped over. */
function topLevelKeys(literal: string): string[] {
  const body = literal.slice(1, -1);
  const keys: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let atKeyPosition = true;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if ("{[(".includes(char)) depth += 1;
    else if ("}])".includes(char)) depth -= 1;
    else if (char === "," && depth === 0) atKeyPosition = true;
    else if (depth === 0 && atKeyPosition && /[A-Za-z_$]/.test(char)) {
      const match = /^([A-Za-z_$][\w$]*)\s*[:,}]/.exec(body.slice(i));
      const shorthand = /^([A-Za-z_$][\w$]*)\s*$/.exec(body.slice(i));
      if (match) keys.push(match[1]);
      else if (shorthand) keys.push(shorthand[1]);
      atKeyPosition = false;
    }
  }
  return keys;
}

type CallSite = { file: string; module: string; fn: string; keys: string[] };

function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  const pattern = /useQuery\(\s*api\.(\w+)\.(\w+)\s*,\s*/g;
  for (const dir of roots) {
    for (const file of sourceFiles(dir)) {
      const source = readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source))) {
        const rest = source.slice(match.index + match[0].length);
        // The literal must follow the comma directly, optionally behind a `cond ?`
        // guard so `cond ? { ... } : "skip"` is still read. Anything else (a
        // variable, a call) carries keys that cannot be read statically.
        const prefix = /^\s*(?:[^;(){}[\]]*?\?\s*)?(?=\{)/.exec(rest);
        if (!prefix) continue;
        const literal = objectLiteralAt(rest, prefix[0].length);
        // A spread hides keys from static reading; there is nothing to assert.
        if (!literal || literal.includes("...")) continue;
        sites.push({
          file: path.relative(root, file),
          module: match[1],
          fn: match[2],
          keys: topLevelKeys(literal),
        });
      }
    }
  }
  return sites;
}

type ArgsSpec = { value?: Record<string, { optional: boolean }> };

async function validatorFields(module: string, fn: string): Promise<Set<string> | null> {
  let mod: Record<string, unknown>;
  try {
    mod = (await import(`../convex/${module}`)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const target = mod[fn] as { exportArgs?: () => string } | undefined;
  if (typeof target?.exportArgs !== "function") return null;
  const spec = JSON.parse(target.exportArgs()) as ArgsSpec;
  return new Set(Object.keys(spec.value ?? {}));
}

describe("Convex query argument contracts", () => {
  it("finds the call sites it is meant to guard", () => {
    const sites = callSites();
    expect(sites.length).toBeGreaterThan(10);
    expect(
      sites.some((s) => s.module === "dashboard" && s.fn === "getDashboardData"),
    ).toBe(true);
  });

  it("sends no argument the query does not declare", async () => {
    const offenders: string[] = [];
    for (const site of callSites()) {
      const declared = await validatorFields(site.module, site.fn);
      if (!declared) continue;
      for (const key of site.keys) {
        if (!declared.has(key)) {
          offenders.push(`${site.file}: api.${site.module}.${site.fn} sends "${key}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
