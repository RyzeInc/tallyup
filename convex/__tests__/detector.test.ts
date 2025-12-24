import { describe, it, expect } from 'vitest';
import { detectRecurringCandidatesFromEntries, Entry } from '../detector';

function daysAgo(n: number) { return Date.now() - n * 24 * 3600 * 1000; }

describe('detector', () => {
  it('detects monthly recurring entries', () => {
    const entries: Entry[] = [
      { _id: 'a', type: 'expense', amountCents: 10000, date: daysAgo(30), bucket: 'Personal', category: 'Rent' },
      { _id: 'b', type: 'expense', amountCents: 10000, date: daysAgo(60), bucket: 'Personal', category: 'Rent' },
      { _id: 'c', type: 'expense', amountCents: 10000, date: daysAgo(90), bucket: 'Personal', category: 'Rent' },
      { _id: 'd', type: 'expense', amountCents: 10000, date: daysAgo(120), bucket: 'Personal', category: 'Rent' },
    ];

    const out = detectRecurringCandidatesFromEntries(entries, { lookbackDays: 365, minOccurrences: 3 });
    expect(out.length).toBeGreaterThan(0);
    const top = out[0];
    expect(top.intervalType).toBe('monthly');
    expect(top.occurrences).toBeGreaterThanOrEqual(3);
    expect(top.confidence).toBeGreaterThanOrEqual(50);
  });

  it('detects weekly recurring entries', () => {
    const entries: Entry[] = [];
    for (let i = 1; i <= 6; i++) {
      entries.push({ _id: `w${i}`, type: 'expense', amountCents: 5000, date: daysAgo(i * 7), bucket: 'Subscriptions', category: 'Music' });
    }
    const out = detectRecurringCandidatesFromEntries(entries, { lookbackDays: 365, minOccurrences: 3 });
    expect(out.length).toBeGreaterThan(0);
    const top = out[0];
    expect(top.intervalType).toBe('weekly');
    expect(top.occurrences).toBeGreaterThanOrEqual(3);
  });

  it('ignores noise and small counts', () => {
    const entries: Entry[] = [
      { _id: 'x1', type: 'expense', amountCents: 400, date: daysAgo(10), bucket: 'Coffee', category: 'Food' },
      { _id: 'x2', type: 'expense', amountCents: 1400, date: daysAgo(20), bucket: 'Coffee', category: 'Food' },
    ];
    const out = detectRecurringCandidatesFromEntries(entries, { lookbackDays: 365, minOccurrences: 3 });
    expect(out.length).toBe(0);
  });

  it('detects monthly recurring variable amounts (utilities)', () => {
    const entries: Entry[] = [
      { _id: 'u1', type: 'expense', amountCents: 8500, date: daysAgo(30), bucket: 'Household', category: 'Electric' },
      { _id: 'u2', type: 'expense', amountCents: 7900, date: daysAgo(60), bucket: 'Household', category: 'Electric' },
      { _id: 'u3', type: 'expense', amountCents: 9200, date: daysAgo(90), bucket: 'Household', category: 'Electric' },
      { _id: 'u4', type: 'expense', amountCents: 8100, date: daysAgo(120), bucket: 'Household', category: 'Electric' },
    ];

    const out = detectRecurringCandidatesFromEntries(entries, { lookbackDays: 365, minOccurrences: 3 });
    expect(out.length).toBeGreaterThan(0);
    const top = out[0];
    expect(top.intervalType).toBe('monthly');
    expect(top.amountMode).toBe('range');
    expect(top.amountTolerancePercent).toBeGreaterThan(0);
  });
});