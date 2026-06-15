import { useState, useEffect, useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import { useAppSelector, useAppDispatch, useNavigateWithDebug } from '../../common/hooks';
import {
  addPendingOptimisticId,
  removePendingOptimisticId,
  addShoppingItemToState,
  updateShoppingItemInState,
  removeShoppingItems,
} from './slice';
import { addShoppingItem, updateShoppingItem } from '../../firebase/firestore';
import { parseShoppingItemText } from '../../common/aiParsing';
import { UnitValue } from '../../types';
import type { ShoppingItem } from '../../types';

const FAMILY_ID = 'default-family';

export interface UseShoppingItemActionsReturn {
  editingItemId: string | null;
  editingItemText: string;
  setEditingItemText: (text: string) => void;
  addingNewItem: boolean;
  newItemText: string;
  setNewItemText: (text: string) => void;
  newItemGroupId: string | null;
  editDialogItemIds: string[];
  itemEditInputRef: RefObject<HTMLTextAreaElement | null>;
  handleSaveItemText: () => Promise<void>;
  handleCancelItemEdit: () => void;
  handleStartEditItem: (itemId: string, currentText: string, itemIds: string[]) => void;
  handleAddNewItem: (groupId?: string) => void;
  handleSaveNewItem: () => void;
  handleCancelNewItem: () => void;
  handleOpenEditDialog: (itemIds: string[]) => void;
  handleCloseEditDialog: () => void;
}

export function useShoppingItemActions(
  setCollapsedGroups: Dispatch<SetStateAction<Set<string>>>
): UseShoppingItemActionsReturn {
  const dispatch = useAppDispatch();
  const navigate = useNavigateWithDebug();
  const items = useAppSelector((state) => state.shopping?.items || []);

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [addingNewItem, setAddingNewItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemGroupId, setNewItemGroupId] = useState<string | null>(null);
  const [editDialogItemIds, setEditDialogItemIds] = useState<string[]>([]);
  const itemEditInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isItemEditCancelingRef = useRef(false);

  useEffect(() => {
    if ((editingItemId || addingNewItem) && itemEditInputRef.current) {
      itemEditInputRef.current.focus();
      itemEditInputRef.current.select();
    }
  }, [editingItemId, addingNewItem]);

  const handleSaveItemText = useCallback(async () => {
    if (isItemEditCancelingRef.current) {
      isItemEditCancelingRef.current = false;
      return;
    }
    if (!editingItemId) return;

    const originalText = editingItemText.trim();
    if (!originalText) {
      setEditingItemId(null);
      setEditingItemText('');
      return;
    }

    const item = items.find((i) => i.id === editingItemId);
    if (!item || item.originalText === originalText) {
      setEditingItemId(null);
      setEditingItemText('');
      return;
    }

    let amount: number | null = null;
    let unit: typeof UnitValue[keyof typeof UnitValue] | null = null;
    let name = '';
    try {
      const parsed = await parseShoppingItemText(originalText);
      amount = parsed.amount;
      unit = parsed.unit as typeof UnitValue[keyof typeof UnitValue] | null;
      name = parsed.name;
    } catch (error) {
      console.error('Error parsing ingredient:', error);
    }

    try {
      await updateShoppingItem(editingItemId, { originalText, name, amount, unit });
    } catch (error) {
      console.error('Error updating item:', error);
    }
    setEditingItemId(null);
    setEditingItemText('');
  }, [editingItemId, editingItemText, items]);

  const handleCancelItemEdit = useCallback(() => {
    isItemEditCancelingRef.current = true;
    setEditingItemId(null);
    setEditingItemText('');
    if (itemEditInputRef.current) itemEditInputRef.current.blur();
  }, []);

  // Aggregated items (multiple sourceItemIds) navigate to the full edit page
  const handleStartEditItem = useCallback(
    (itemId: string, currentText: string, itemIds: string[]) => {
      if (itemIds.length > 1) {
        navigate(`/shopping/edit/${itemIds[0]}`);
      } else {
        setEditingItemId(itemId);
        setEditingItemText(currentText);
      }
    },
    [navigate]
  );

  const handleAddNewItem = useCallback(
    (groupId?: string) => {
      setAddingNewItem(true);
      setNewItemText('');
      setNewItemGroupId(groupId ?? null);
      if (groupId) {
        setCollapsedGroups((prev) => {
          const next = new Set(prev);
          next.delete(groupId);
          return next;
        });
      }
    },
    [setCollapsedGroups]
  );

  // Optimistic: item appears immediately; parse + Firestore run in background.
  // On failure: item stays in Redux for potential retry later.
  const handleSaveNewItem = useCallback(() => {
    if (isItemEditCancelingRef.current) {
      isItemEditCancelingRef.current = false;
      return;
    }

    const originalText = newItemText.trim();
    if (!originalText) {
      setAddingNewItem(false);
      setNewItemText('');
      setNewItemGroupId(null);
      return;
    }

    const groupIdToAdd = newItemGroupId;
    const now = new Date().toISOString();
    const optimisticId = `opt-${Date.now()}`;

    const optimisticItem: ShoppingItem = {
      id: optimisticId,
      familyId: FAMILY_ID,
      originalText,
      name: originalText,
      amount: null,
      unit: null,
      isChecked: false,
      tagIds: [],
      createdAt: now,
      updatedAt: now,
      ...(groupIdToAdd && { customGroupId: groupIdToAdd }),
    };
    dispatch(addShoppingItemToState(optimisticItem));
    dispatch(addPendingOptimisticId(optimisticId));

    setAddingNewItem(false);
    setNewItemText('');
    setNewItemGroupId(null);

    const persistItem = async () => {
      let amount: number | null = null;
      let unit: typeof UnitValue[keyof typeof UnitValue] | null = null;
      let name = originalText;
      try {
        const parsed = await parseShoppingItemText(originalText);
        amount = parsed.amount;
        unit = parsed.unit as typeof UnitValue[keyof typeof UnitValue] | null;
        name = parsed.name;
        dispatch(updateShoppingItemInState({ ...optimisticItem, amount, unit, name, id: optimisticId }));
      } catch (error) {
        console.error('Error parsing ingredient:', error);
      }

      try {
        await addShoppingItem({
          familyId: FAMILY_ID,
          originalText,
          name,
          amount,
          unit,
          isChecked: false,
          tagIds: [],
          ...(groupIdToAdd && { customGroupId: groupIdToAdd }),
        });
        dispatch(removePendingOptimisticId(optimisticId));
        // Subscription delivers the real item; removing the optimistic avoids a duplicate
        dispatch(removeShoppingItems([optimisticId]));
      } catch (error) {
        console.error('Error adding item to Firestore:', error);
        // Keep item in Redux (pending flag prevents overwrite); retry TBD
      }
    };
    persistItem();
  }, [newItemText, newItemGroupId, dispatch]);

  const handleCancelNewItem = useCallback(() => {
    isItemEditCancelingRef.current = true;
    setAddingNewItem(false);
    setNewItemText('');
    setNewItemGroupId(null);
    if (itemEditInputRef.current) itemEditInputRef.current.blur();
  }, []);

  const handleOpenEditDialog = useCallback(
    (itemIds: string[]) => {
      if (itemIds.length > 1) {
        navigate(`/shopping/edit/${itemIds[0]}`);
      } else {
        setEditDialogItemIds(itemIds);
      }
    },
    [navigate]
  );

  const handleCloseEditDialog = useCallback(() => {
    setEditDialogItemIds([]);
  }, []);

  return {
    editingItemId,
    editingItemText,
    setEditingItemText,
    addingNewItem,
    newItemText,
    setNewItemText,
    newItemGroupId,
    editDialogItemIds,
    itemEditInputRef,
    handleSaveItemText,
    handleCancelItemEdit,
    handleStartEditItem,
    handleAddNewItem,
    handleSaveNewItem,
    handleCancelNewItem,
    handleOpenEditDialog,
    handleCloseEditDialog,
  };
}
