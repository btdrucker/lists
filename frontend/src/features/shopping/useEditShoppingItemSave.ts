import { useState, useCallback } from 'react';
import { addShoppingItem, updateShoppingItem } from '../../firebase/firestore';
import { parseShoppingItemText } from '../../common/ingredient-parsing-api';
import type { ShoppingItem } from '../../types';
import { UnitValue } from '../../types';

type UnitValueType = typeof UnitValue[keyof typeof UnitValue];

const FAMILY_ID = 'default-family';

interface EditableItem {
  id: string;
  originalText: string;
  tagIds: string[];
  sourceRecipeId?: string;
}

interface UseSaveOptions {
  isAddMode: boolean;
  editableItems: EditableItem[];
  relatedItems: ShoppingItem[];
  customGroupId?: string;
  onSuccess: () => void;
}

interface UseSaveResult {
  isSaving: boolean;
  handleSave: () => Promise<void>;
}

export function useEditShoppingItemSave({
  isAddMode,
  editableItems,
  relatedItems,
  customGroupId,
  onSuccess,
}: UseSaveOptions): UseSaveResult {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (isAddMode) {
        const item = editableItems[0];
        const originalText = item.originalText.trim();
        if (!originalText) {
          alert('Please enter an item');
          setIsSaving(false);
          return;
        }

        let amount: number | null = null;
        let unit: UnitValueType | null = null;
        let name = '';
        try {
          const parsed = await parseShoppingItemText(originalText);
          amount = parsed.amount;
          unit = parsed.unit as UnitValueType | null;
          name = parsed.name;
        } catch (error) {
          console.error('Error parsing ingredient:', error);
        }

        await addShoppingItem({
          familyId: FAMILY_ID,
          originalText,
          name,
          amount,
          unit,
          isChecked: false,
          tagIds: item.tagIds,
          ...(customGroupId && { customGroupId }),
        });
      } else {
        for (const item of editableItems) {
          const original = relatedItems.find((i) => i.id === item.id);
          if (!original) continue;

          const updates: Partial<ShoppingItem> = {};
          const originalTextChanged = item.originalText !== (original.originalText ?? '');
          const tagIdsChanged =
            JSON.stringify([...item.tagIds].sort()) !==
            JSON.stringify([...original.tagIds].sort());

          if (originalTextChanged) {
            updates.originalText = item.originalText.trim();
            let amount: number | null = null;
            let unit: UnitValueType | null = null;
            let name = '';
            try {
              const parsed = await parseShoppingItemText(item.originalText.trim());
              amount = parsed.amount;
              unit = parsed.unit as UnitValueType | null;
              name = parsed.name;
            } catch (error) {
              console.error('Error parsing ingredient:', error);
            }
            updates.amount = amount;
            updates.unit = unit;
            updates.name = name;
          }
          if (tagIdsChanged) updates.tagIds = item.tagIds;

          if (Object.keys(updates).length > 0) {
            await updateShoppingItem(item.id, updates);
          }
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving items:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [isAddMode, editableItems, relatedItems, customGroupId, onSuccess]);

  return { isSaving, handleSave };
}
