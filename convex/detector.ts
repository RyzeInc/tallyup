export type Entry = {
  _id?: any; // optional convex id
  date: number; // ms
  amountCents: number;
  type: "expense" | "income";
  bucket?: string | null;
  category?: string | null;
  tags?: string[] | null;
};

export type Candidate = {
  type: "expense" | "income";
  bucket?: string;
  category?: string;
  // Suggested amount and tolerance (median and percent)
  amountCents?: number;
  amountTolerancePercent?: number;
  amountMode?: "fixed" | "range" | "unknown";
  intervalType: "daily" | "weekly" | "monthly" | "custom";
  intervalDays?: number;
  occurrences: number;
  medianIntervalDays: number;
  stddevIntervalDays: number;
  confidence: number; // 0-100
  exampleEntryIds: any[]; // sample entry ids
};

function daysBetween(a: number, b: number) {
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[mid - 1] + s[mid]) / 2;
  return s[mid];
}

function stddev(nums: number[], mean?: number) {
  if (nums.length === 0) return 0;
  const m = mean ?? nums.reduce((s, v) => s + v, 0) / nums.length;
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

export function detectRecurringCandidatesFromEntries(
  entries: Entry[],
  opts?: { lookbackDays?: number; minOccurrences?: number }
): Candidate[] {
  const lookbackDays = opts?.lookbackDays ?? 365;
  const minOccurrences = opts?.minOccurrences ?? 3;
  const cutoff = Date.now() - lookbackDays * 24 * 3600 * 1000;

  const filtered = entries.filter(e => e.date >= cutoff);

  // normalize and bucket by (type, bucket, category)
  const groups = new Map<string, Entry[]>();
  for (const e of filtered) {
    const type = e.type;
    const bucket = (e.bucket ?? "").trim().toLowerCase();
    const category = (e.category ?? "").trim().toLowerCase();
    const key = `${type}|${bucket}|${category}`;
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  const candidates: Candidate[] = [];

  for (const [key, group] of groups.entries()) {
    if (group.length < minOccurrences) continue;
    // sort by date
    const sorted = [...group].sort((a, b) => a.date - b.date);
    // compute intervals between consecutive occurrences
    const intervals = [] as number[];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(daysBetween(sorted[i].date, sorted[i - 1].date));
    }
    if (intervals.length === 0) continue;
    const med = median(intervals);
    const sd = stddev(intervals, med);
    const cv = med === 0 ? 0 : sd / med; // coefficient of variation

    // filter unrealistic median intervals
    if (med < 2) continue; // ignore near-daily noise in prototype

    // determine interval type
    let intervalType: Candidate['intervalType'] = 'custom';
    if (med >= 25 && med <= 35) intervalType = 'monthly';
    else if (med >= 6 && med <= 9) intervalType = 'weekly';
    else if (med >= 0.5 && med <= 2) intervalType = 'daily';

    // compute confidence: base on number of occurrences and consistency
    const base = Math.min(80, 30 + (group.length - minOccurrences) * 10);
    const consistencyBonus = Math.max(0, Math.min(50, Math.round((1 - Math.min(1, cv)) * 50)));
    let confidence = base + consistencyBonus;
    if (confidence > 100) confidence = 100;

    const [type, bucket, category] = key.split('|');

    // compute amount stats for the group
    const amounts = sorted.map(s => s.amountCents);
    const medianAmount = median(amounts);
    const sdAmount = stddev(amounts, medianAmount);
    const relVar = medianAmount === 0 ? 0 : sdAmount / medianAmount;

    // decide amount mode & tolerance
    let amountMode: Candidate['amountMode'] = 'unknown';
    let amountTolerancePercent: number | undefined = undefined;
    if (relVar < 0.05) {
      amountMode = 'fixed';
      amountTolerancePercent = Math.max(1, Math.round(relVar * 100 * 2));
    } else if (relVar < 0.4) {
      amountMode = 'range';
      amountTolerancePercent = Math.max(5, Math.round(relVar * 100 * 1.5));
    } else {
      amountMode = 'unknown';
      amountTolerancePercent = undefined;
    }

    candidates.push({
      type: type as "expense" | "income",
      bucket: bucket || undefined,
      category: category || undefined,
      amountCents: Math.round(medianAmount),
      amountTolerancePercent: amountTolerancePercent,
      amountMode,
      intervalType,
      intervalDays: intervalType === 'custom' ? Math.round(med) : undefined,
      occurrences: group.length,
      medianIntervalDays: med,
      stddevIntervalDays: sd,
      confidence,
      exampleEntryIds: sorted.slice(0, 5).map(e => e._id ?? null),
    });
  }

  // sort candidates by confidence desc
  return candidates.sort((a, b) => b.confidence - a.confidence);
}
