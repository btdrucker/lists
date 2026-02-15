import type { ShoppingItem, Tag, CombinedItem } from '../../types';
import Checkbox from '../../common/components/Checkbox';
import ParsedFieldsDebug from '../../common/components/ParsedFieldsDebug';
import { formatAmount } from '../../common/ingredientDisplay';
import { useDebugMode } from '../../common/hooks';
import styles from './shoppingItemRow.module.css';

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
  onStartEdit: (itemId: string, currentText: string, itemIds: string[]) => void;
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
  const displayText = item.originalText;
  const debugMode = useDebugMode();

  const handleTextareaFocus = () => {
    if (!isEditingThis) {
      onStartEdit(itemId, displayText, itemIds);
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
            <textarea
              ref={isEditingThis ? itemEditInputRef : undefined}
              className={`${styles.itemTextarea} ${item.isChecked ? styles.itemTextareaChecked : ''}`}
              value={isEditingThis ? editingItemText : displayText}
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
        {debugMode && (
          <ParsedFieldsDebug
            amount={item.amount}
            unit={item.unit}
            name={item.name}
          />
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
