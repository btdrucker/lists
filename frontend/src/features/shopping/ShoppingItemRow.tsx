import { useEffect, useRef } from 'react';
import { UnitValue } from '../../types';
import type { ShoppingItem, Store, CombinedItem } from '../../types';
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

// Format amount and unit for display
function formatAmount(amount: number | null, unit: string | null): string {
  // Treat null and EACH the same - just show amount without unit label
  if (unit === UnitValue.EACH || unit === null) {
    return amount ? `${amount}` : '';
  }
  
  if (!amount && !unit) return '';
  const unitLabel = unit ? UNIT_LABELS[unit] || unit.toLowerCase() : '';
  if (!amount) return unitLabel;
  return `${amount} ${unitLabel}`.trim();
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
  handleItemClick: (itemId: string) => void;
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
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Set indeterminate property on checkbox
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  return (
    <div
      className={`${styles.item} ${item.isChecked ? styles.itemChecked : ''}`}
      onClick={() => handleItemClick(itemId)}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        className={styles.checkbox}
        checked={item.isChecked}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          // If indeterminate, check all source items
          const newCheckedState = isIndeterminate ? true : e.target.checked;
          handleCheck(itemIds, newCheckedState);
        }}
      />
      <div className={styles.itemDetails}>
        <div className={styles.itemMainRow}>
          <div className={styles.itemNameRow}>
            <span className={styles.itemText}>
              {formatAmount(item.amount, item.unit) && `${formatAmount(item.amount, item.unit)} `}
              {item.name}
            </span>
          </div>
          <div className={styles.itemStoreSection}>
            <button
              className={styles.addStoreButton}
              onClick={(e) => {
                e.stopPropagation();
                setStoreDialogItemKey(isDialogOpen ? null : itemKey);
              }}
            >
              <i className="fa-solid fa-bookmark" />
            </button>
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
