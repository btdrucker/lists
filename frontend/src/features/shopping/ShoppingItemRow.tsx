import { UnitValue } from '../../types';
import type { ShoppingItem, Tag, CombinedItem } from '../../types';
import Checkbox from '../../common/components/Checkbox';
import styles from './shoppingItemRow.module.css';

// Unit labels for display
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
  [UnitValue.SLICE]: 'slice',
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

// Convert decimal number to fraction character display
function decimalToFraction(decimal: number): string {
  // Handle zero or very small numbers
  if (decimal < 0.001) return '0';
  
  // Separate whole and fractional parts
  const whole = Math.floor(decimal);
  const fractional = decimal - whole;
  
  // Handle whole numbers (with small tolerance for floating point errors)
  if (fractional < 0.01) return whole.toString();
  
  // Common fractions with their Unicode characters and decimal values
  // Ordered by decimal value for clarity
  const fractions = [
    { decimal: 0.125, char: '⅛' },
    { decimal: 0.2, char: '⅕' },
    { decimal: 0.25, char: '¼' },
    { decimal: 0.333, char: '⅓' },
    { decimal: 0.375, char: '⅜' },
    { decimal: 0.4, char: '⅖' },
    { decimal: 0.5, char: '½' },
    { decimal: 0.6, char: '⅗' },
    { decimal: 0.625, char: '⅝' },
    { decimal: 0.666, char: '⅔' },
    { decimal: 0.75, char: '¾' },
    { decimal: 0.8, char: '⅘' },
    { decimal: 0.875, char: '⅞' },
  ];
  
  // Find closest matching fraction (within tolerance)
  const tolerance = 0.02;
  const match = fractions.find(f => Math.abs(fractional - f.decimal) < tolerance);
  
  if (match) {
    return whole > 0 ? `${whole}${match.char}` : match.char;
  }
  
  // If no match, fall back to decimal with 2 decimal places
  return decimal.toFixed(2).replace(/\.?0+$/, '');
}

// Format amount and unit for display
function formatAmount(amount: number | null, unit: string | null): string {
  // Treat null and EACH the same - just show amount without unit label
  if (unit === UnitValue.EACH || unit === null) {
    return amount ? decimalToFraction(amount) : '';
  }
  
  if (!amount && !unit) return '';
  const unitLabel = unit ? UNIT_LABELS[unit] || unit.toLowerCase() : '';
  if (!amount) return unitLabel;
  return `${decimalToFraction(amount)} ${unitLabel}`.trim();
}

interface ShoppingItemRowProps {
  item: CombinedItem | ShoppingItem;
  itemId: string;
  itemIds: string[];
  itemKey: string;
  isIndeterminate: boolean;
  isCombined: boolean;
  tags: Tag[];
  handleCheck: (itemIds: string[], isChecked: boolean) => void;
  editingItemId: string | null;
  editingItemText: string;
  setEditingItemText: (text: string) => void;
  onStartEdit: (itemId: string, currentText: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  itemEditInputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onOpenEditDialog: (itemIds: string[]) => void;
}

const ShoppingItemRow = ({
  item,
  itemId,
  itemIds,
  itemKey: _itemKey,
  isIndeterminate,
  isCombined,
  tags,
  handleCheck,
  editingItemId,
  editingItemText,
  setEditingItemText,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  itemEditInputRef,
  onOpenEditDialog,
}: ShoppingItemRowProps) => {
  const isEditingThis = editingItemId === itemId;
  const amountPrefix = formatAmount(item.amount, item.unit);

  const handleTextareaFocus = () => {
    if (!isEditingThis) {
      onStartEdit(itemId, item.name);
    }
  };

  const handleTextareaBlur = () => {
    if (isEditingThis) {
      onSaveEdit();
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isEditingThis) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        onCancelEdit();
      }
    }
  };

  return (
    <div
      className={`${styles.item} ${item.isChecked ? styles.itemChecked : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <Checkbox
        checked={item.isChecked}
        indeterminate={isIndeterminate}
        onChange={(newChecked) => handleCheck(itemIds, newChecked)}
        className={styles.itemCheckbox}
      />
      <div className={styles.itemDetails}>
        <div className={styles.itemMainRow}>
          <div className={styles.itemNameRow}>
            {amountPrefix && <span className={styles.itemAmountPrefix}>{amountPrefix} </span>}
            <textarea
              ref={isEditingThis ? itemEditInputRef : undefined}
              className={`${styles.itemTextarea} ${item.isChecked ? styles.itemTextareaChecked : ''}`}
              value={isEditingThis ? editingItemText : item.name}
              readOnly={!isEditingThis}
              onChange={(e) => isEditingThis && setEditingItemText(e.target.value)}
              onFocus={handleTextareaFocus}
              onBlur={handleTextareaBlur}
              onKeyDown={handleTextareaKeyDown}
              rows={1}
              aria-label="Item name"
            />
          </div>
        </div>
        {isCombined && (item as CombinedItem).sourceItemIds.length > 1 && (
          <div className={styles.itemSource}>
            from {(item as CombinedItem).sourceItemIds.length} sources
          </div>
        )}
      </div>
      <button
        className={styles.itemEditButton}
        onClick={(e) => {
          e.stopPropagation();
          onOpenEditDialog(itemIds);
        }}
        aria-label="Edit item tags and details"
        type="button"
      >
        <i className="fa-solid fa-tag" />
      </button>
      {item.tagIds.length > 0 && (
        <div className={styles.itemTags}>
          {[...tags]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .filter((tag) => item.tagIds.includes(tag.id))
            .map((tag) => (
              <span
                key={tag.id}
                className={styles.itemTag}
                style={{ backgroundColor: tag.color }}
              >
                {tag.abbreviation}
              </span>
            ))}
        </div>
      )}
    </div>
  );
};

export default ShoppingItemRow;
