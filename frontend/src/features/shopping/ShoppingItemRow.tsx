import { useEffect, useRef, useState } from 'react';
import { UnitValue } from '../../types';
import type { ShoppingItem, Store, CombinedItem } from '../../types';
import Checkbox from '../../common/components/Checkbox';
import StoreTagDialog from './StoreTagDialog';
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
  stores: Store[];
  storeDialogItemKey: string | null;
  setStoreDialogItemKey: (key: string | null) => void;
  handleItemClick: (itemId: string, isCombined: boolean) => void;
  handleCheck: (itemIds: string[], isChecked: boolean) => void;
  handleItemStoreToggle: (itemIds: string[], storeId: string) => void;
}

const ShoppingItemRow = ({
  item,
  itemId,
  itemIds,
  itemKey,
  isIndeterminate,
  isCombined,
  stores,
  storeDialogItemKey,
  setStoreDialogItemKey,
  handleItemClick,
  handleCheck,
  handleItemStoreToggle,
}: ShoppingItemRowProps) => {
  const isDialogOpen = storeDialogItemKey === itemKey;
  const storeSectionRef = useRef<HTMLDivElement>(null);
  const [showDialogAbove, setShowDialogAbove] = useState<boolean | null>(null);

  // Calculate dialog position when it opens
  useEffect(() => {
    if (isDialogOpen && storeSectionRef.current) {
      const rect = storeSectionRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedDialogHeight = 250; // Rough estimate
      
      // Show above if not enough space below and there's more space above
      setShowDialogAbove(spaceBelow < estimatedDialogHeight && rect.top > spaceBelow);
    } else if (!isDialogOpen) {
      // Reset when dialog closes
      setShowDialogAbove(null);
    }
  }, [isDialogOpen]);

  return (
    <div
      className={`${styles.item} ${item.isChecked ? styles.itemChecked : ''}`}
      onClick={() => handleItemClick(itemId, isCombined)}
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
            <span className={styles.itemText}>
              {formatAmount(item.amount, item.unit) && `${formatAmount(item.amount, item.unit)} `}
              {item.name}
            </span>
          </div>
          <div className={styles.itemStoreSection} ref={storeSectionRef}>
            {/* Store selection button hidden for cleaner UI - kept for potential reuse
            <div
              className={`${styles.addStoreButtonWrapper} ${item.isChecked ? styles.addStoreButtonWrapperDisabled : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!item.isChecked) {
                  setStoreDialogItemKey(isDialogOpen ? null : itemKey);
                }
              }}
            >
              <button className={styles.addStoreButton} disabled={item.isChecked}>
                <i className="fa-solid fa-bookmark" />
              </button>
            </div>
            */}
            {item.storeTagIds.length > 0 && (
              <div className={styles.itemStoreTags}>
                {item.storeTagIds.map((storeId) => {
                  const store = stores.find((s) => s.id === storeId);
                  if (!store) return null;
                  return (
                    <span
                      key={storeId}
                      className={styles.itemStoreTag}
                      style={{ backgroundColor: store.color }}
                    >
                      {store.abbreviation}
                    </span>
                  );
                })}
              </div>
            )}
            {isDialogOpen && (
              <StoreTagDialog
                stores={stores}
                selectedStoreIds={item.storeTagIds}
                itemIds={itemIds}
                onStoreToggle={handleItemStoreToggle}
                showAbove={showDialogAbove === true}
                isPositioned={showDialogAbove !== null}
              />
            )}
          </div>
        </div>
        {isCombined && (item as CombinedItem).sourceItemIds.length > 1 && (
          <div className={styles.itemSource}>
            from {(item as CombinedItem).sourceItemIds.length} sources
          </div>
        )}
      </div>
    </div>
  );
};

export default ShoppingItemRow;
