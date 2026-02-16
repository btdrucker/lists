import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppSelector, useAppDispatch, useNavigateWithDebug, useAddRecipeToCart } from '../../common/hooks';
import { setShoppingItems, setTags, setShoppingGroups, removeShoppingItems, setViewMode, setSelectedTagIds, addShoppingItemToState } from './slice';
import {
  subscribeToShoppingItems,
  subscribeToTags,
  subscribeToShoppingGroups,
  initializeDefaultTags,
  addShoppingItem,
  updateShoppingItem,
  bulkDeleteShoppingItems,
  addShoppingGroup,
  updateShoppingGroup,
  deleteShoppingGroup,
} from '../../firebase/firestore';
import { UnitValue } from '../../types';
import type { ShoppingItem, Tag, ShoppingGroup, CombinedItem, GroupedItems, Recipe } from '../../types';
import { parseShoppingItemText } from '../../common/aiParsing';
import { buildAggregatedDisplayString } from '../../common/ingredientDisplay';
import RecipePicker from '../../common/components/RecipePicker';
import EditTagsDialog from './EditTagsDialog';
import ItemTagDialog from './ItemTagDialog';
import Checkbox from '../../common/components/Checkbox';
import CollapseToggle from './CollapseToggle';
import ShoppingItemRow from './ShoppingItemRow';
import NewItemRow from './NewItemRow';
import { signOut } from '../../firebase/auth';
import CircleIconButton from '../../common/components/CircleIconButton';
import styles from './shopping.module.css';

const FAMILY_ID = 'default-family';

// Normalize ingredient name for combining
function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Grouping key for aggregating items. Returns null when there's no parsed name
 * (e.g. parse failed) - those items never group with anything.
 * Match rule: two items group only when getItemKey(a) === getItemKey(b) and both are non-null.
 */
function getItemKey(item: ShoppingItem): string | null {
  if (!item.name?.trim()) return null;
  return `${normalizeItemName(item.name)}:${item.unit}`;
}

// Combine items with same name + exact unit match. Items with null key never group.
function combineItems(items: ShoppingItem[]): CombinedItem[] {
  const grouped = new Map<string, ShoppingItem[]>();
  const ungroupable: ShoppingItem[] = [];

  items.forEach((item) => {
    const key = getItemKey(item);
    if (key === null) {
      ungroupable.push(item);
    } else {
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }
  });

  const toCombined = (key: string, sourceItems: ShoppingItem[]) => {
    const totalAmount = sourceItems.reduce(
      (sum, item) => sum + (item.amount || 0),
      0
    );
    const allChecked = sourceItems.every((item) => item.isChecked);
    const someChecked = sourceItems.some((item) => item.isChecked);
    const isIndeterminate = someChecked && !allChecked;
    const allTagIds = [
      ...new Set(sourceItems.flatMap((item) => item.tagIds)),
    ];
    const newestCreatedAt = sourceItems.reduce(
      (max, item) =>
        (item.createdAt > max ? item.createdAt : max) as string,
      sourceItems[0].createdAt
    );
    const isAggregated = sourceItems.length > 1;
    const name = sourceItems[0].name;
    const originalText = isAggregated
      ? buildAggregatedDisplayString(totalAmount || null, sourceItems[0].unit, name ?? '')
      : sourceItems[0].originalText;

    return {
      key,
      originalText,
      name,
      amount: totalAmount || null,
      unit: sourceItems[0].unit,
      isChecked: allChecked,
      isIndeterminate,
      tagIds: allTagIds,
      sourceItemIds: sourceItems.map((item) => item.id),
      newestCreatedAt,
    };
  };

  const combinedFromGroups = Array.from(grouped.entries()).map(([key, sourceItems]) =>
    toCombined(key, sourceItems)
  );
  const combinedFromUngroupable = ungroupable.map((item) =>
    toCombined(item.id, [item])
  );

  return [...combinedFromGroups, ...combinedFromUngroupable]
    .sort((a, b) => b.newestCreatedAt.localeCompare(a.newestCreatedAt))
    .map(({ newestCreatedAt: _, ...item }) => item);
}

// Group items by recipe source and custom groups
function groupItems(
  items: ShoppingItem[],
  recipes: Recipe[],
  groups: ShoppingGroup[]
): GroupedItems {
  const recipeMap = new Map<string, ShoppingItem[]>();
  const customGroupMap = new Map<string, ShoppingItem[]>();
  const manualItems: ShoppingItem[] = [];

  // Build a set of valid group IDs for quick lookup
  const validGroupIds = new Set(groups.map((g) => g.id));
  
  // Priority: customGroupId (if valid) > sourceRecipeId > manual
  items.forEach((item) => {
    if (item.customGroupId && validGroupIds.has(item.customGroupId)) {
      // Only group by customGroupId if the group still exists
      if (!customGroupMap.has(item.customGroupId)) {
        customGroupMap.set(item.customGroupId, []);
      }
      customGroupMap.get(item.customGroupId)!.push(item);
    } else if (item.sourceRecipeId) {
      if (!recipeMap.has(item.sourceRecipeId)) {
        recipeMap.set(item.sourceRecipeId, []);
      }
      recipeMap.get(item.sourceRecipeId)!.push(item);
    } else {
      // Items with invalid customGroupId fall back to manual items
      manualItems.push(item);
    }
  });

  // Build recipe groups with titles; preserve ingredient order (no sort)
  const recipeGroupsBuilt = Array.from(recipeMap.entries()).map(
    ([recipeId, groupItems]) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      const newestCreatedAt =
        groupItems.length > 0
          ? groupItems.reduce(
              (max, item) =>
                (item.createdAt > max ? item.createdAt : max) as string,
              groupItems[0].createdAt
            )
          : '';
      return {
        recipeId,
        recipeTitle: recipe?.title || 'Unknown Recipe',
        items: [...groupItems],
        newestCreatedAt,
      };
    }
  );
  const recipeGroups = recipeGroupsBuilt
    .sort((a, b) => b.newestCreatedAt.localeCompare(a.newestCreatedAt))
    .map(({ newestCreatedAt: _, ...g }) => g);

  // Build custom groups with names; sort items newest-first
  // Include ALL groups from Firestore, even empty ones
  const customGroups = groups
    .map((group) => {
      const groupItemsList = customGroupMap.get(group.id) || [];
      return {
        groupId: group.id,
        groupName: group.displayName,
        sortOrder: group.sortOrder,
        items: [...groupItemsList].sort(
          (a, b) => (b.createdAt as string).localeCompare(a.createdAt as string)
        ),
      };
    })
    .sort((a, b) => b.sortOrder - a.sortOrder)
    .map(({ groupId, groupName, items }) => ({ groupId, groupName, items }));

  // Sort manual items newest-first
  const sortedManualItems = [...manualItems].sort(
    (a, b) => (b.createdAt as string).localeCompare(a.createdAt as string)
  );

  return { recipeGroups, customGroups, manualItems: sortedManualItems };
}

// Helper to check if an item is indeterminate (works for both CombinedItem and ShoppingItem)
function isItemIndeterminate(item: CombinedItem | ShoppingItem): boolean {
  return 'isIndeterminate' in item && item.isIndeterminate;
}

// Helper to get source item IDs (works for both CombinedItem and ShoppingItem)
function getItemIds(item: CombinedItem | ShoppingItem): string[] {
  return 'sourceItemIds' in item ? item.sourceItemIds : [item.id];
}

const Shopping = () => {
  const navigate = useNavigateWithDebug();
  const dispatch = useAppDispatch();
  const addRecipeToCart = useAddRecipeToCart();
  const items: ShoppingItem[] = useAppSelector((state) => state.shopping?.items || []);
  const tags: Tag[] = useAppSelector((state) => state.shopping?.tags || []);
  const groups: ShoppingGroup[] = useAppSelector((state) => state.shopping?.groups || []);
  const loading = useAppSelector((state) => state.shopping?.loading ?? true);
  const recipes: Recipe[] = useAppSelector((state) => state.recipes?.recipes || []);
  const viewMode = useAppSelector((state) => state.shopping?.viewMode || 'simple');
  const selectedTagIds = useAppSelector((state) => state.shopping?.selectedTagIds || []);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [showEditTags, setShowEditTags] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const [loadingRecipeIds, setLoadingRecipeIds] = useState<Map<string, string>>(new Map());
  const menuRef = useRef<HTMLDivElement>(null);
  const itemEditInputRef = useRef<HTMLTextAreaElement>(null);
  const isItemEditCancelingRef = useRef(false);

  // Inline item editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [addingNewItem, setAddingNewItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemGroupId, setNewItemGroupId] = useState<string | null>(null);
  const [editDialogItemIds, setEditDialogItemIds] = useState<string[]>([]);

  // Track checked empty groups (groups with no items that user wants to delete)
  const [checkedEmptyGroupIds, setCheckedEmptyGroupIds] = useState<Set<string>>(new Set());

  // Set up real-time listeners
  useEffect(() => {
    let unsubItems: (() => void) | undefined;
    let unsubTags: (() => void) | undefined;
    let unsubGroups: (() => void) | undefined;

    const initAndSubscribe = async () => {
      try {
        // Initialize default tags (safe to call multiple times)
        await initializeDefaultTags(FAMILY_ID);

        // Set up real-time listeners
        unsubItems = subscribeToShoppingItems(FAMILY_ID, (newItems) => {
          dispatch(setShoppingItems(newItems));
        });

        unsubTags = subscribeToTags(FAMILY_ID, (newTags) => {
          dispatch(setTags(newTags));
        });

        unsubGroups = subscribeToShoppingGroups(FAMILY_ID, (newGroups) => {
          dispatch(setShoppingGroups(newGroups));
        });
      } catch (error) {
        console.error('Error initializing shopping list:', error);
        // Set loading to false to show empty state instead of infinite loading
        dispatch(setShoppingItems([]));
        dispatch(setTags([]));
        dispatch(setShoppingGroups([]));
      }
    };

    initAndSubscribe();

    return () => {
      if (unsubItems) unsubItems();
      if (unsubTags) unsubTags();
      if (unsubGroups) unsubGroups();
    };
  }, [dispatch]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showMenu]);

  // Items with no originalText are invalid - exclude from display and grouping
  const itemsWithOriginalText = useMemo(
    () => items.filter((i) => (i.originalText ?? '').trim().length > 0),
    [items]
  );

  // Filter items by selected tags
  const filteredItems = useMemo(() => {
    if (selectedTagIds.length === 0) return itemsWithOriginalText;
    return itemsWithOriginalText.filter(
      (item) =>
        item.tagIds.length === 0 ||
        item.tagIds.some((id) => selectedTagIds.includes(id))
    );
  }, [itemsWithOriginalText, selectedTagIds]);

  // Prepare display items based on view mode
  const combinedItems = useMemo(() => {
    return combineItems(filteredItems);
  }, [filteredItems]);

  const groupedItems = useMemo(() => {
    return groupItems(filteredItems, recipes, groups);
  }, [filteredItems, recipes, groups]);

  // Track which group IDs had items in the previous render
  const prevGroupIdsWithItemsRef = useRef<Set<string>>(new Set());
  
  // Auto-delete custom groups only when their last item is removed
  useEffect(() => {
    const currentGroupIdsWithItems = new Set(
      itemsWithOriginalText
        .filter((item) => item.customGroupId)
        .map((item) => item.customGroupId as string)
    );
    
    const prevGroupIdsWithItems = prevGroupIdsWithItemsRef.current;
    
    // Find groups that HAD items before but now have none
    const groupsThatBecameEmpty = [...prevGroupIdsWithItems].filter(
      (groupId) => !currentGroupIdsWithItems.has(groupId)
    );
    
    // Update ref for next comparison
    prevGroupIdsWithItemsRef.current = currentGroupIdsWithItems;
    
    // Delete groups that just became empty
    const deleteEmptyGroups = async () => {
      for (const groupId of groupsThatBecameEmpty) {
        // Verify the group still exists before deleting
        const groupExists = groups.some((g) => g.id === groupId);
        if (groupExists) {
          try {
            await deleteShoppingGroup(groupId);
          } catch (error) {
            console.error('Error deleting empty group:', error);
          }
        }
      }
    };

    if (groupsThatBecameEmpty.length > 0) {
      deleteEmptyGroups();
    }
  }, [itemsWithOriginalText, groups]);

  // Count checked items for bulk delete - only fully checked items in current view
  const checkedItemIds = useMemo(() => {
    const itemsToCheck = viewMode === 'simple' ? combinedItems : filteredItems;
    return itemsToCheck
      .filter((item) => item.isChecked && !isItemIndeterminate(item))
      .flatMap((item) => getItemIds(item));
  }, [viewMode, combinedItems, filteredItems]);

  // Count of VISIBLE checked items (for display in delete button)
  const checkedItemCount = useMemo(() => {
    const itemsToCheck = viewMode === 'simple' ? combinedItems : filteredItems;
    return itemsToCheck.filter((item) => item.isChecked && !isItemIndeterminate(item)).length;
  }, [viewMode, combinedItems, filteredItems]);

  // Toggle tag filter
  const handleTagToggle = useCallback((tagId: string) => {
    const newSelectedTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    dispatch(setSelectedTagIds(newSelectedTagIds));
  }, [selectedTagIds, dispatch]);

  // Check/uncheck item
  const handleCheck = useCallback(
    async (itemIds: string[], isChecked: boolean) => {
      try {
        for (const id of itemIds) {
          await updateShoppingItem(id, { isChecked });
        }
      } catch (error) {
        console.error('Error updating item:', error);
      }
    },
    []
  );

  // Helper to compute group checked state
  const getGroupCheckedState = useCallback((groupItems: ShoppingItem[], groupId?: string): 'all' | 'some' | 'none' => {
    if (groupItems.length === 0) {
      // Empty group - check if it's in checkedEmptyGroupIds
      return groupId && checkedEmptyGroupIds.has(groupId) ? 'all' : 'none';
    }
    const checkedCount = groupItems.filter((item) => item.isChecked).length;
    if (checkedCount === 0) return 'none';
    if (checkedCount === groupItems.length) return 'all';
    return 'some';
  }, [checkedEmptyGroupIds]);

  // Toggle all items in a group (or toggle empty group checked state)
  const handleGroupCheckToggle = useCallback(
    async (groupItems: ShoppingItem[], groupId?: string) => {
      if (groupItems.length === 0 && groupId) {
        // Empty group - toggle checked state
        setCheckedEmptyGroupIds((prev) => {
          const next = new Set(prev);
          if (next.has(groupId)) {
            next.delete(groupId);
          } else {
            next.add(groupId);
          }
          return next;
        });
        return;
      }
      
      const currentState = getGroupCheckedState(groupItems, groupId);
      // If all checked, uncheck all. Otherwise, check all.
      const newCheckedState = currentState !== 'all';
      try {
        // Update all items in parallel
        const updates = groupItems
          .filter((item) => item.isChecked !== newCheckedState)
          .map((item) => updateShoppingItem(item.id, { isChecked: newCheckedState }));
        await Promise.all(updates);
      } catch (error) {
        console.error('Error toggling group items:', error);
      }
    },
    [getGroupCheckedState]
  );

  // Clear checkedEmptyGroupIds for groups that now have items
  useEffect(() => {
    const groupsWithItems = new Set(
      groupedItems.customGroups
        .filter((group) => group.items.length > 0)
        .map((group) => group.groupId)
    );
    
    setCheckedEmptyGroupIds((prev) => {
      // Remove any groupIds that now have items
      const stillEmpty = new Set([...prev].filter((id) => !groupsWithItems.has(id)));
      if (stillEmpty.size !== prev.size) {
        return stillEmpty;
      }
      return prev;
    });
  }, [groupedItems.customGroups]);

  // Find fully-checked custom groups (for deletion with bulk delete)
  const fullyCheckedCustomGroupIds = useMemo(() => {
    const groupsWithAllChecked = groupedItems.customGroups
      .filter((group) => group.items.length > 0 && group.items.every((item) => item.isChecked))
      .map((group) => group.groupId);
    
    // Also include checked empty groups (only those that are still empty)
    const emptyGroupIds = new Set(
      groupedItems.customGroups
        .filter((group) => group.items.length === 0)
        .map((group) => group.groupId)
    );
    const checkedEmpty = [...checkedEmptyGroupIds].filter((id) => emptyGroupIds.has(id));
    
    return [...groupsWithAllChecked, ...checkedEmpty];
  }, [groupedItems.customGroups, checkedEmptyGroupIds]);

  // Bulk delete checked items (and fully-checked custom groups)
  const handleBulkDelete = useCallback(async () => {
    const hasItems = checkedItemIds.length > 0;
    const hasGroups = fullyCheckedCustomGroupIds.length > 0;
    
    if (!hasItems && !hasGroups) return;

    const groupCount = fullyCheckedCustomGroupIds.length;
    const itemCount = checkedItemIds.length;
    
    let message: string;
    if (hasItems && hasGroups) {
      message = `Delete ${itemCount} checked item${itemCount > 1 ? 's' : ''} and ${groupCount} group${groupCount > 1 ? 's' : ''}?`;
    } else if (hasGroups) {
      message = `Delete ${groupCount} group${groupCount > 1 ? 's' : ''}?`;
    } else {
      message = `Delete ${itemCount} checked item${itemCount > 1 ? 's' : ''}?`;
    }

    if (!window.confirm(message)) {
      return;
    }

    try {
      // Delete items if any
      if (hasItems) {
        dispatch(removeShoppingItems(checkedItemIds));
        await bulkDeleteShoppingItems(checkedItemIds);
      }
      
      // Delete fully-checked custom groups
      for (const groupId of fullyCheckedCustomGroupIds) {
        await deleteShoppingGroup(groupId);
      }
      
      // Clear checked empty groups state
      setCheckedEmptyGroupIds(new Set());
    } catch (error) {
      console.error('Error deleting items:', error);
      // Real-time listener will restore correct state on error
    }
  }, [checkedItemIds, fullyCheckedCustomGroupIds, dispatch]);

  // Toggle group collapsed state
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Handle recipes selected from picker
  const handleRecipesSelected = useCallback(
    async (recipeIds: string[]) => {
      try {
        for (const recipeId of recipeIds) {
          const recipe = recipes.find((r) => r.id === recipeId);
          if (!recipe) continue;

          setLoadingRecipeIds(prev => new Map(prev).set(recipeId, recipe.title));

          const result = await addRecipeToCart(recipe);

          setLoadingRecipeIds(prev => {
            const next = new Map(prev);
            next.delete(recipeId);
            return next;
          });

          if (result.addedCount === 0 && result.totalCount > 0) {
            alert(`"${recipe.title}" is already on your shopping list.`);
          }
        }
      } catch (error) {
        console.error('Error adding recipes:', error);
        alert('Failed to add recipes');
        setLoadingRecipeIds(new Map());
      }
    },
    [recipes, addRecipeToCart]
  );

  // Inline editing state for custom group names
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const editingInputRef = useRef<HTMLTextAreaElement>(null);
  const isCancelingRef = useRef(false);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editingGroupId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingGroupId]);

  // Create a new custom group
  const handleAddGroup = useCallback(async () => {
    try {
      const newGroup = await addShoppingGroup({
        familyId: FAMILY_ID,
        displayName: 'New Group',
        sortOrder: Date.now(),
      });
      // Immediately enter edit mode for the new group
      setEditingGroupId(newGroup.id);
      setEditingGroupName(newGroup.displayName);
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    }
  }, []);

  // Start editing a group name
  const handleStartEditGroupName = useCallback((groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditingGroupName(currentName);
  }, []);

  // Save the edited group name
  const handleSaveGroupName = useCallback(async () => {
    // Don't save if we're canceling
    if (isCancelingRef.current) {
      isCancelingRef.current = false;
      return;
    }
    
    if (!editingGroupId) return;
    
    const trimmedName = editingGroupName.trim();
    if (!trimmedName) {
      // Revert to original name if empty
      setEditingGroupId(null);
      setEditingGroupName('');
      return;
    }

    try {
      await updateShoppingGroup(editingGroupId, { displayName: trimmedName });
    } catch (error) {
      console.error('Error updating group name:', error);
    }
    
    setEditingGroupId(null);
    setEditingGroupName('');
  }, [editingGroupId, editingGroupName]);

  // Cancel editing
  const handleCancelEditGroupName = useCallback(() => {
    // Set flag to prevent save on blur
    isCancelingRef.current = true;
    setEditingGroupId(null);
    setEditingGroupName('');
    // Blur the textarea
    if (editingInputRef.current) {
      editingInputRef.current.blur();
    }
  }, []);

  // Focus item edit textarea when entering edit mode
  useEffect(() => {
    if ((editingItemId || addingNewItem) && itemEditInputRef.current) {
      itemEditInputRef.current.focus();
      itemEditInputRef.current.select();
    }
  }, [editingItemId, addingNewItem]);

  // Add new item (plus icon) - show inline row
  const handleAddNewItem = useCallback((groupId?: string) => {
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
  }, []);

  // Save inline-edited item - store originalText, reparse for amount/unit/name
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
      // Leave amount/unit/name blank - parsing still required (retry TBD)
    }

    try {
      await updateShoppingItem(editingItemId, {
        originalText,
        name,
        amount,
        unit,
      });
    } catch (error) {
      console.error('Error updating item:', error);
    }
    setEditingItemId(null);
    setEditingItemText('');
  }, [editingItemId, editingItemText, items]);

  // Cancel inline item edit
  const handleCancelItemEdit = useCallback(() => {
    isItemEditCancelingRef.current = true;
    setEditingItemId(null);
    setEditingItemText('');
    if (itemEditInputRef.current) itemEditInputRef.current.blur();
  }, []);

  // Start inline editing an item. Aggregated items → EditShoppingItem (can't inline-edit multiple).
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

  // Save new item (from add row)
  const handleSaveNewItem = useCallback(async () => {
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
    setAddingNewItem(false);
    setNewItemText('');
    setNewItemGroupId(null);

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
      // Leave amount/unit/name blank - parsing still required (retry TBD)
    }

    const now = new Date().toISOString();
    const optimisticItem: ShoppingItem = {
      id: `opt-${Date.now()}`,
      familyId: FAMILY_ID,
      originalText,
      name,
      amount,
      unit,
      isChecked: false,
      tagIds: [],
      createdAt: now,
      updatedAt: now,
      ...(groupIdToAdd && { customGroupId: groupIdToAdd }),
    };
    dispatch(addShoppingItemToState(optimisticItem));

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
    } catch (error) {
      console.error('Error adding item:', error);
      dispatch(removeShoppingItems([optimisticItem.id]));
    }
  }, [newItemText, newItemGroupId]);

  // Cancel new item
  const handleCancelNewItem = useCallback(() => {
    isItemEditCancelingRef.current = true;
    setAddingNewItem(false);
    setNewItemText('');
    setNewItemGroupId(null);
    if (itemEditInputRef.current) itemEditInputRef.current.blur();
  }, []);

  // Open edit dialog for item(s). Aggregated items → EditShoppingItem (all contributing items); single → ItemTagDialog (tags).
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

  // Close edit dialog
  const handleCloseEditDialog = useCallback(() => {
    setEditDialogItemIds([]);
  }, []);

  // Render individual item
  const renderItem = (
    item: CombinedItem | ShoppingItem,
    isCombined: boolean
  ) => {
    const itemIds = getItemIds(item);
    const itemId = itemIds[0];
    const itemKey = isCombined ? (item as CombinedItem).key : (item as ShoppingItem).id;
    const isIndeterminate = isItemIndeterminate(item);
    const isEditingThis = editingItemId === itemId;

    return (
      <ShoppingItemRow
        key={itemKey}
        item={item}
        itemId={itemId}
        itemIds={itemIds}
        itemKey={itemKey}
        isIndeterminate={isIndeterminate}
        isCombined={isCombined}
        tags={tags}
        handleCheck={handleCheck}
        editingItemId={editingItemId}
        editingItemText={editingItemText}
        setEditingItemText={setEditingItemText}
        onStartEdit={handleStartEditItem}
        onSaveEdit={handleSaveItemText}
        onCancelEdit={handleCancelItemEdit}
        itemEditInputRef={isEditingThis ? itemEditInputRef : undefined}
        onOpenEditDialog={handleOpenEditDialog}
      />
    );
  };

  if (loading) {
    return <div className={styles.loading}>Loading shopping list...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.stickyHeader}>
        <div className={styles.header}>
          <h1>Shopping List</h1>
          <div className={styles.headerButtons}>
            <CircleIconButton
              icon="fa-plus"
              onClick={() => handleAddNewItem()}
              ariaLabel="Add item"
            />
            <div className={styles.menuContainer} ref={menuRef}>
              <CircleIconButton
                icon="fa-ellipsis-vertical"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                ariaLabel="Menu"
              />
              {showMenu && (
                <div className={styles.menuDropdown}>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      setShowRecipePicker(true);
                      setShowMenu(false);
                    }}
                  >
                    <i className="fa-solid fa-plus" /> Add Recipe
                  </button>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      // Switch to grouped view if not already
                      if (viewMode !== 'recipe-grouped') {
                        dispatch(setViewMode('recipe-grouped'));
                      }
                      handleAddGroup();
                      setShowMenu(false);
                    }}
                  >
                    <i className="fa-solid fa-folder-plus" /> Add Group
                  </button>
                  <button
                    className={styles.menuItem}
                    onClick={() => {
                      setShowEditTags(true);
                      setShowMenu(false);
                    }}
                  >
                    <i className="fa-solid fa-tags" /> {tags.length === 0 ? 'New Tag' : 'Edit Tags'}
                  </button>
                  <button
                    className={`${styles.menuItem} ${checkedItemIds.length === 0 && fullyCheckedCustomGroupIds.length === 0 ? styles.menuItemDisabled : ''}`}
                    onClick={() => {
                      if (checkedItemIds.length > 0 || fullyCheckedCustomGroupIds.length > 0) {
                        handleBulkDelete();
                        setShowMenu(false);
                      }
                    }}
                    disabled={checkedItemIds.length === 0 && fullyCheckedCustomGroupIds.length === 0}
                  >
                    <i className="fa-solid fa-trash" /> Delete Checked{checkedItemIds.length > 0 ? ` (${checkedItemCount})` : ''}{checkedItemIds.length === 0 && fullyCheckedCustomGroupIds.length > 0 ? ` (${fullyCheckedCustomGroupIds.length} group${fullyCheckedCustomGroupIds.length > 1 ? 's' : ''})` : ''}
                  </button>
                  <div className={styles.menuDivider} />
                  <button
                    className={`${styles.menuItem} ${styles.menuItemSignOut}`}
                    onClick={async () => {
                      try {
                        await signOut();
                        setShowMenu(false);
                      } catch (error) {
                        console.error('Error signing out:', error);
                      }
                    }}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <label className={styles.groupControl}>
            <span className={styles.groupLabel}>Group</span>
            <div className={styles.toggleWrapper}>
              <input
                type="checkbox"
                className={styles.toggleInput}
                checked={viewMode === 'recipe-grouped'}
                onChange={() => dispatch(setViewMode(viewMode === 'simple' ? 'recipe-grouped' : 'simple'))}
              />
              <span className={styles.toggleSlider}></span>
            </div>
          </label>

          {tags.length > 0 && (
            <div className={styles.tagFilter}>
              {[...tags]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((tag) => (
                  <div
                    key={tag.id}
                    className={styles.tagWrapper}
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    <button
                      className={`${styles.tag} ${
                        selectedTagIds.includes(tag.id)
                          ? styles.tagSelected
                          : ''
                      }`}
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.abbreviation}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>

      {/* Empty state - Simple view: show when no items and not adding */}
      {items.length === 0 && !addingNewItem && viewMode === 'simple' && (
        <div className={styles.empty}>
          <p>No items yet</p>
          <p>Add items manually or from your recipes</p>
        </div>
      )}

      {/* Empty state - Grouped view: show when no items AND no groups and not adding */}
      {items.length === 0 && groups.length === 0 && !addingNewItem && viewMode === 'recipe-grouped' && (
        <div className={styles.empty}>
          <p>No items yet</p>
          <p>Add items manually or from your recipes</p>
        </div>
      )}

      {/* Item list - Simple view */}
      {((items.length > 0 || addingNewItem) && viewMode === 'simple') && (
        <div className={styles.itemList}>
          {addingNewItem && !newItemGroupId && (
            <NewItemRow
              value={newItemText}
              onChange={setNewItemText}
              onBlur={handleSaveNewItem}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                else if (e.key === 'Escape') handleCancelNewItem();
              }}
              inputRef={itemEditInputRef}
            />
          )}
          {combinedItems.map((item) => renderItem(item, true))}
        </div>
      )}

      {/* Item list - Recipe grouped view */}
      {(items.length > 0 || groups.length > 0) && viewMode === 'recipe-grouped' && (
        <div>

          {/* Manual items - shown directly without a header */}
          {(groupedItems.manualItems.length > 0 || (addingNewItem && !newItemGroupId)) && (
            <div className={styles.manualItemsSection}>
              <div className={styles.itemList}>
                {addingNewItem && !newItemGroupId && (
                  <NewItemRow
                    value={newItemText}
                    onChange={setNewItemText}
                    onBlur={handleSaveNewItem}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                      else if (e.key === 'Escape') handleCancelNewItem();
                    }}
                    inputRef={itemEditInputRef}
                  />
                )}
                {groupedItems.manualItems.map((item) =>
                  renderItem(item, false)
                )}
              </div>
            </div>
          )}

          {/* Custom groups */}
          {groupedItems.customGroups.map((group) => (
            <div key={group.groupId} className={styles.recipeGroup}>
              <div className={styles.recipeGroupHeader}>
                <div
                  className={styles.recipeGroupHeaderContent}
                  onClick={() => {
                    if (editingGroupId !== group.groupId) {
                      toggleGroupCollapse(group.groupId);
                    }
                  }}
                >
                  <Checkbox
                    checked={getGroupCheckedState(group.items, group.groupId) === 'all'}
                    indeterminate={getGroupCheckedState(group.items, group.groupId) === 'some'}
                    onChange={() => handleGroupCheckToggle(group.items, group.groupId)}
                    className={styles.groupCheckboxLeft}
                  />
                  <textarea
                    ref={editingGroupId === group.groupId ? editingInputRef : undefined}
                    className={`${styles.editableGroupNameInput} ${getGroupCheckedState(group.items, group.groupId) === 'all' ? styles.groupTitleChecked : ''}`}
                    value={editingGroupId === group.groupId ? editingGroupName : group.groupName}
                    readOnly={editingGroupId !== group.groupId}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onFocus={() => {
                      if (editingGroupId !== group.groupId) {
                        handleStartEditGroupName(group.groupId, group.groupName);
                      }
                    }}
                    onBlur={editingGroupId === group.groupId ? handleSaveGroupName : undefined}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (editingGroupId === group.groupId) {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveGroupName();
                        } else if (e.key === 'Escape') {
                          handleCancelEditGroupName();
                        }
                      }
                    }}
                  />
                  <button
                    className={styles.groupAddButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNewItem(group.groupId);
                    }}
                    aria-label="Add item to group"
                  >
                    <i className="fa-solid fa-plus" />
                  </button>
                  <CollapseToggle
                    collapsed={collapsedGroups.has(group.groupId)}
                    onToggle={() => toggleGroupCollapse(group.groupId)}
                  />
                </div>
              </div>
              {!collapsedGroups.has(group.groupId) && (
                <div className={styles.itemList}>
                  {addingNewItem && newItemGroupId === group.groupId && (
                    <NewItemRow
                      value={newItemText}
                      onChange={setNewItemText}
                      onBlur={handleSaveNewItem}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                        else if (e.key === 'Escape') handleCancelNewItem();
                      }}
                      inputRef={itemEditInputRef}
                    />
                  )}
                  {group.items.map((item) => renderItem(item, false))}
                </div>
              )}
            </div>
          ))}
          

          {/* Recipe groups */}
          {groupedItems.recipeGroups.map((group) => (
            <div key={group.recipeId} className={styles.recipeGroup}>
              <div className={styles.recipeGroupHeader}>
                <div
                  className={styles.recipeGroupHeaderContent}
                  onClick={() => toggleGroupCollapse(group.recipeId)}
                >
                  {loadingRecipeIds.has(group.recipeId) ? (
                    <i className={`fa-solid fa-circle-notch fa-spin ${styles.groupCheckboxLeft} ${getGroupCheckedState(group.items) !== 'none' ? styles.groupSpinnerChecked : ''}`}></i>
                  ) : (
                    <Checkbox
                      checked={getGroupCheckedState(group.items) === 'all'}
                      indeterminate={getGroupCheckedState(group.items) === 'some'}
                      onChange={() => handleGroupCheckToggle(group.items)}
                      className={styles.groupCheckboxLeft}
                    />
                  )}
                  <span className={`${styles.groupTitle} ${getGroupCheckedState(group.items) === 'all' ? styles.groupTitleChecked : ''}`}>From "{group.recipeTitle}"</span>
                  <CollapseToggle
                    collapsed={collapsedGroups.has(group.recipeId)}
                    onToggle={() => toggleGroupCollapse(group.recipeId)}
                  />
                </div>
              </div>
              {!collapsedGroups.has(group.recipeId) && (
                <div className={styles.itemList}>
                  {group.items.map((item) => renderItem(item, false))}
                </div>
              )}
            </div>
          ))}

        </div>
      )}

      {/* Recipe picker modal */}
      <RecipePicker
        isOpen={showRecipePicker}
        onClose={() => setShowRecipePicker(false)}
        onSelect={handleRecipesSelected}
      />

      <EditTagsDialog
        isOpen={showEditTags}
        onClose={() => setShowEditTags(false)}
      />

      <ItemTagDialog
        itemIds={editDialogItemIds}
        isOpen={editDialogItemIds.length > 0}
        onClose={handleCloseEditDialog}
      />
    </div>
  );
};

export default Shopping;
