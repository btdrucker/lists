import { useState, useMemo, useCallback, useEffect } from 'react';
import { updateShoppingItem } from '../../firebase/firestore';
import type { ShoppingItem, GroupedItems } from '../../types';

export interface UseShoppingGroupCheckedReturn {
  checkedEmptyGroupIds: Set<string>;
  getGroupCheckedState: (groupItems: ShoppingItem[], groupId?: string) => 'all' | 'some' | 'none';
  handleGroupCheckToggle: (groupItems: ShoppingItem[], groupId?: string) => Promise<void>;
  fullyCheckedCustomGroupIds: string[];
}

export function useShoppingGroupChecked(groupedItems: GroupedItems): UseShoppingGroupCheckedReturn {
  const [checkedEmptyGroupIds, setCheckedEmptyGroupIds] = useState<Set<string>>(new Set());

  // Clear checked state for groups that now have items
  useEffect(() => {
    const groupsWithItems = new Set(
      groupedItems.customGroups.filter((g) => g.items.length > 0).map((g) => g.groupId)
    );
    setCheckedEmptyGroupIds((prev) => {
      const stillEmpty = new Set([...prev].filter((id) => !groupsWithItems.has(id)));
      return stillEmpty.size !== prev.size ? stillEmpty : prev;
    });
  }, [groupedItems.customGroups]);

  const getGroupCheckedState = useCallback(
    (groupItems: ShoppingItem[], groupId?: string): 'all' | 'some' | 'none' => {
      if (groupItems.length === 0) {
        return groupId && checkedEmptyGroupIds.has(groupId) ? 'all' : 'none';
      }
      const checkedCount = groupItems.filter((item) => item.isChecked).length;
      if (checkedCount === 0) return 'none';
      if (checkedCount === groupItems.length) return 'all';
      return 'some';
    },
    [checkedEmptyGroupIds]
  );

  const handleGroupCheckToggle = useCallback(
    async (groupItems: ShoppingItem[], groupId?: string) => {
      if (groupItems.length === 0 && groupId) {
        setCheckedEmptyGroupIds((prev) => {
          const next = new Set(prev);
          next.has(groupId) ? next.delete(groupId) : next.add(groupId);
          return next;
        });
        return;
      }
      const newCheckedState = getGroupCheckedState(groupItems, groupId) !== 'all';
      try {
        await Promise.all(
          groupItems
            .filter((item) => item.isChecked !== newCheckedState)
            .map((item) => updateShoppingItem(item.id, { isChecked: newCheckedState }))
        );
      } catch (error) {
        console.error('Error toggling group items:', error);
      }
    },
    [getGroupCheckedState]
  );

  const fullyCheckedCustomGroupIds = useMemo(() => {
    const withAllChecked = groupedItems.customGroups
      .filter((g) => g.items.length > 0 && g.items.every((item) => item.isChecked))
      .map((g) => g.groupId);
    const emptyGroupIds = new Set(
      groupedItems.customGroups.filter((g) => g.items.length === 0).map((g) => g.groupId)
    );
    return [...withAllChecked, ...[...checkedEmptyGroupIds].filter((id) => emptyGroupIds.has(id))];
  }, [groupedItems.customGroups, checkedEmptyGroupIds]);

  return {
    checkedEmptyGroupIds,
    getGroupCheckedState,
    handleGroupCheckToggle,
    fullyCheckedCustomGroupIds,
  };
}
