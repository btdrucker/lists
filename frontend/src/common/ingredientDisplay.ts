import { UnitValue } from '../types';
import { pluralize } from './pluralize';

const UNIT_LABELS: Record<string, string> = {
  [UnitValue.CUP]: 'cup',
  [UnitValue.TABLESPOON]: 'tbsp',
  [UnitValue.TEASPOON]: 'tsp',
  [UnitValue.FLUID_OUNCE]: 'fl oz',
  [UnitValue.QUART]: 'qt',
  [UnitValue.POUND]: 'lb',
  [UnitValue.WEIGHT_OUNCE]: 'oz',
  [UnitValue.EACH]: 'each',
  [UnitValue.CLOVE]: 'clove',
  [UnitValue.PIECE]: 'piece',
  [UnitValue.CAN]: 'can',
  [UnitValue.BUNCH]: 'bunch',
  [UnitValue.HEAD]: 'head',
  [UnitValue.STALK]: 'stalk',
  [UnitValue.SPRIG]: 'sprig',
  [UnitValue.LEAF]: 'leaf',
  [UnitValue.PINCH]: 'pinch',
  [UnitValue.DASH]: 'dash',
  [UnitValue.HANDFUL]: 'handful',
  [UnitValue.TO_TASTE]: 'to taste',
};

// Individual item units: name is normalized to singular (carrot, onion). Pluralize when amount > 1.
// Matches AI parsing: EACH, CLOVE, HEAD, STALK, SPRIG, LEAF, PIECE, etc.
const COUNT_UNITS = new Set([
  UnitValue.EACH, UnitValue.CLOVE, UnitValue.HEAD, UnitValue.STALK,
  UnitValue.SPRIG, UnitValue.LEAF, UnitValue.PIECE,
]);

// Collective units (CUP, POUND, etc.): name is already plural (lentils) or uncountable (flour). Don't pluralize.
// Uncountable nouns - don't pluralize even for count units (flour, rice, salt, etc.)
const UNCOUNTABLE = new Set([
  'flour', 'sugar', 'salt', 'pepper', 'water', 'milk', 'oil', 'rice',
  'bread', 'butter', 'cheese', 'garlic', 'ginger', 'cinnamon', 'vanilla',
  'honey', 'soy sauce', 'vinegar', 'mustard', 'ketchup', 'mayonnaise',
  'broth', 'stock', 'cream', 'yogurt', 'oatmeal', 'pasta', 'couscous',
  'quinoa', 'cornmeal', 'cocoa', 'chocolate', 'nutmeg', 'paprika',
]);

function decimalToFraction(decimal: number): string {
  if (decimal < 0.001) return '0';
  const whole = Math.floor(decimal);
  const fractional = decimal - whole;
  if (fractional < 0.01) return whole.toString();
  const fractions = [
    { decimal: 0.125, char: '⅛' }, { decimal: 0.2, char: '⅕' },
    { decimal: 0.25, char: '¼' }, { decimal: 0.333, char: '⅓' },
    { decimal: 0.375, char: '⅜' }, { decimal: 0.4, char: '⅖' },
    { decimal: 0.5, char: '½' }, { decimal: 0.6, char: '⅗' },
    { decimal: 0.625, char: '⅝' }, { decimal: 0.666, char: '⅔' },
    { decimal: 0.75, char: '¾' }, { decimal: 0.8, char: '⅘' },
    { decimal: 0.875, char: '⅞' },
  ];
  const tolerance = 0.02;
  const match = fractions.find((f) => Math.abs(fractional - f.decimal) < tolerance);
  if (match) return whole > 0 ? `${whole}${match.char}` : match.char;
  return decimal.toFixed(2).replace(/\.?0+$/, '');
}

/** Format amount and unit for display (e.g. "2 cups", "½", "3"). */
export function formatAmount(amount: number | null, unit: string | null): string {
  if (unit === UnitValue.EACH || unit === null) {
    return amount ? decimalToFraction(amount) : '';
  }
  if (!amount && !unit) return '';
  const unitLabel = getUnitLabel(unit, amount);
  if (!amount) return unitLabel;
  return `${decimalToFraction(amount)} ${unitLabel}`.trim();
}

/** Unit label with pluralization when amount > 1. */
function getUnitLabel(unit: string | null, amount: number | null): string {
  if (!unit) return '';
  const label = UNIT_LABELS[unit] || unit.toLowerCase();
  if ((amount ?? 0) <= 1) return label;
  if (label === 'leaf') return 'leaves';
  if (!label.endsWith('s')) return label + 's';
  return label;
}

/**
 * Build display string for aggregated items from parsed fields.
 * Pluralization depends on BOTH amount and unit:
 * - Count units (EACH, CLOVE, HEAD, STALK, SPRIG, LEAF, PIECE): name is singular → pluralize when amount > 1 ("2 carrots")
 * - Collective units (CUP, POUND, etc.): name is already plural (lentils) → use as-is ("2 cups lentils")
 */
export function buildAggregatedDisplayString(
  amount: number | null,
  unit: string | null,
  name: string
): string {
  const trimmedName = name.trim();
  if (!trimmedName) return '';

  const amountStr = amount != null ? decimalToFraction(amount) : '';
  const unitStr =
    unit && unit !== UnitValue.EACH ? getUnitLabel(unit, amount) : '';
  const isCountUnit = unit != null && COUNT_UNITS.has(unit);
  const shouldPluralize =
    isCountUnit &&
    (amount ?? 0) > 1 &&
    !UNCOUNTABLE.has(trimmedName.toLowerCase());
  const displayName = shouldPluralize
    ? pluralize(trimmedName, amount ?? 0)
    : trimmedName;

  const parts = [amountStr, unitStr, displayName].filter(Boolean);
  return parts.join(' ').trim();
}
