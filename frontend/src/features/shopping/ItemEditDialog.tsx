import { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '../../common/hooks';
import { updateShoppingItem } from '../../firebase/firestore';
import Dialog from '../../common/components/Dialog';
import { UnitValue } from '../../types';
import type { ShoppingItem, Tag } from '../../types';
import styles from './itemEditDialog.module.css';

type UnitValueType = (typeof UnitValue)[keyof typeof UnitValue];

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

interface ItemEditDialogProps {
  itemIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

const ItemEditDialog = ({ itemIds, isOpen, onClose }: ItemEditDialogProps) => {
  const items: ShoppingItem[] = useAppSelector((state) => state.shopping?.items || []);
  const tags: Tag[] = useAppSelector((state) => state.shopping?.tags || []);

  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [name, setName] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sourceItems = itemIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is ShoppingItem => i != null);

  // Populate form when dialog opens
  useEffect(() => {
    if (!isOpen || sourceItems.length === 0) return;

    const first = sourceItems[0];
    setAmount(first.amount != null ? String(first.amount) : '');
    setUnit(first.unit || '');
    setName(first.name);
    setTagIds([...first.tagIds]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when dialog opens or itemIds change
  }, [isOpen, itemIds.join(',')]);

  const handleTagToggle = useCallback((tagId: string) => {
    setTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (sourceItems.length === 0) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        amount: amount ? parseFloat(amount) : null,
        unit: (unit as UnitValueType) || null,
        name: trimmedName,
        tagIds,
      };

      for (const item of sourceItems) {
        await updateShoppingItem(item.id, updates);
      }
      onClose();
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setIsSaving(false);
    }
  }, [sourceItems, amount, unit, name, tagIds, onClose]);

  if (!isOpen) return null;

  const title = sourceItems.length > 1 ? 'Edit Items' : 'Edit Item';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      headerActions={
        <div className={styles.dialogActions}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSaving}
            type="button"
          >
            Cancel
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div>
        <div className={styles.formRow}>
          <div className={styles.formGroupSmall}>
            <label className={styles.label}>Amount</label>
            <input
              type="number"
              className={styles.input}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="any"
              placeholder="Qty"
            />
          </div>
          <div className={styles.formGroupMedium}>
            <label className={styles.label}>Unit</label>
            <select
              className={styles.select}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="">No unit</option>
              {Object.entries(UNIT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Name</label>
          <input
            type="text"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
          />
        </div>
        <div className={styles.tagsSection}>
          <label className={styles.label}>Tags</label>
          <div className={styles.tags}>
            {[...tags]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={`${styles.tag} ${tagIds.includes(tag.id) ? styles.tagSelected : ''}`}
                  style={{ backgroundColor: tag.color }}
                  onClick={() => handleTagToggle(tag.id)}
                >
                  {tag.displayName}
                </button>
              ))}
          </div>
        </div>
        {sourceItems.length > 1 && (
          <p className={styles.sourceInfo}>Editing {sourceItems.length} combined items</p>
        )}
      </div>
    </Dialog>
  );
};

export default ItemEditDialog;
