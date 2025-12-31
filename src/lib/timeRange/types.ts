export type PresetRangeKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom";

export type PresetSelectionKey = Exclude<PresetRangeKey, "custom">;

export type TimeRangeSelection =
  | { kind: "preset"; key: PresetSelectionKey }
  | { kind: "custom"; from: string; to: string };

export interface ResolvedRange {
  from: Date;
  to: Date; // exclusive end
}
