import { ResolvedRange } from "./types";

export function toQueryArgs(range: ResolvedRange): { fromMs: number; toMs: number } {
  return { fromMs: range.from.getTime(), toMs: range.to.getTime() };
}
