import type { MealPlanItem } from '../../types';

export const IDEAS_KEY = 'ideas';

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDayLabel(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function buildDateWindow(today: Date, pastDays: number, futureDays: number): Date[] {
  const dates: Date[] = [];
  for (let i = -pastDays; i <= futureDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function groupItemsByDate(items: MealPlanItem[]): Map<string, MealPlanItem[]> {
  const map = new Map<string, MealPlanItem[]>();
  for (const item of items) {
    const key = item.date ?? IDEAS_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  for (const [, groupItems] of map) {
    groupItems.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
}

/** Returns one below the current minimum sortOrder for the given date bucket. */
export function nextSortOrder(itemsByDate: Map<string, MealPlanItem[]>, dateKey: string): number {
  const dayItems = itemsByDate.get(dateKey) ?? [];
  const min = dayItems.length > 0 ? Math.min(...dayItems.map((i) => i.sortOrder)) : 0;
  return min - 1;
}
