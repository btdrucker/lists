import { describe, it, expect } from 'vitest';
import {
  formatDateKey,
  formatDayLabel,
  buildDateWindow,
  groupItemsByDate,
  nextSortOrder,
  IDEAS_KEY,
} from './mealplan-utils';
import type { MealPlanItem } from '../../types';

function makeItem(overrides: Partial<MealPlanItem> = {}): MealPlanItem {
  return {
    id: 'item1',
    familyId: 'fam',
    type: 'note',
    text: 'Buy milk',
    date: '2024-06-01',
    sortOrder: 0,
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// formatDateKey
// ---------------------------------------------------------------------------

describe('formatDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDateKey(new Date(2024, 5, 1))).toBe('2024-06-01');
  });

  it('zero-pads month and day', () => {
    expect(formatDateKey(new Date(2024, 0, 9))).toBe('2024-01-09');
  });
});

// ---------------------------------------------------------------------------
// formatDayLabel
// ---------------------------------------------------------------------------

describe('formatDayLabel', () => {
  it('formats a Saturday in June', () => {
    // June 1 2024 is a Saturday
    expect(formatDayLabel(new Date(2024, 5, 1))).toBe('Sat, Jun 1');
  });

  it('formats a Monday in January', () => {
    // Jan 1 2024 is a Monday
    expect(formatDayLabel(new Date(2024, 0, 1))).toBe('Mon, Jan 1');
  });
});

// ---------------------------------------------------------------------------
// buildDateWindow
// ---------------------------------------------------------------------------

describe('buildDateWindow', () => {
  it('builds the correct number of days', () => {
    const today = new Date(2024, 5, 15);
    const window = buildDateWindow(today, 3, 7);
    expect(window).toHaveLength(11); // 3 past + today + 7 future
  });

  it('first date is pastDays before today', () => {
    const today = new Date(2024, 5, 15);
    const window = buildDateWindow(today, 3, 7);
    expect(formatDateKey(window[0])).toBe('2024-06-12');
  });

  it('last date is futureDays after today', () => {
    const today = new Date(2024, 5, 15);
    const window = buildDateWindow(today, 3, 7);
    expect(formatDateKey(window[window.length - 1])).toBe('2024-06-22');
  });
});

// ---------------------------------------------------------------------------
// groupItemsByDate
// ---------------------------------------------------------------------------

describe('groupItemsByDate', () => {
  it('groups items by their date field', () => {
    const items = [
      makeItem({ id: 'a', date: '2024-06-01', sortOrder: 1 }),
      makeItem({ id: 'b', date: '2024-06-01', sortOrder: 0 }),
      makeItem({ id: 'c', date: '2024-06-02', sortOrder: 0 }),
    ];
    const grouped = groupItemsByDate(items);
    expect(grouped.get('2024-06-01')).toHaveLength(2);
    expect(grouped.get('2024-06-02')).toHaveLength(1);
  });

  it('assigns null-date items to the IDEAS_KEY bucket', () => {
    const items = [makeItem({ id: 'idea', date: null as unknown as string })];
    const grouped = groupItemsByDate(items);
    expect(grouped.has(IDEAS_KEY)).toBe(true);
    expect(grouped.get(IDEAS_KEY)).toHaveLength(1);
  });

  it('sorts items within each group by sortOrder ascending', () => {
    const items = [
      makeItem({ id: 'second', date: '2024-06-01', sortOrder: 10 }),
      makeItem({ id: 'first', date: '2024-06-01', sortOrder: 1 }),
    ];
    const grouped = groupItemsByDate(items);
    const group = grouped.get('2024-06-01')!;
    expect(group[0].id).toBe('first');
    expect(group[1].id).toBe('second');
  });
});

// ---------------------------------------------------------------------------
// nextSortOrder
// ---------------------------------------------------------------------------

describe('nextSortOrder', () => {
  it('returns -1 when the date bucket is empty', () => {
    expect(nextSortOrder(new Map(), '2024-06-01')).toBe(-1);
  });

  it('returns one below the current minimum sortOrder', () => {
    const map = new Map([
      ['2024-06-01', [makeItem({ sortOrder: 5 }), makeItem({ sortOrder: 3 })]],
    ]);
    expect(nextSortOrder(map, '2024-06-01')).toBe(2);
  });
});
