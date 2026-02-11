import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { setShoppingItems, setTags, setShoppingGroups, removeShoppingItems, setViewMode, setSelectedTagIds } from './slice';
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
import type { ShoppingItem, Tag, ShoppingGroup, CombinedItem, GroupedItems, Recipe } from '../../types';
import { ensureRecipeHasAiParsingAndUpdate, getEffectiveIngredientValues } from '../../common/aiParsing';
import type { RecipeWithAiMetadata } from '../../common/aiParsing';
import { getIngredientsNeedingAiIndices } from '../../common/aiParsing';
import RecipePicker from '../../common/components/RecipePicker';
import EditTagsDialog from './EditTagsDialog';
import Checkbox from '../../common/components/Checkbox';
import CollapseToggle from './CollapseToggle';
import ShoppingItemRow from './ShoppingItemRow';
import { signOut } from '../../firebase/auth';
import styles from './shopping.module.css';

const FAMILY_ID = 'default-family';

// Pantry items that users typically always have - skip adding to shopping list
const PANTRY_ITEMS = new Set([
  'water',
  'salt',
  'pepper',
  'black pepper',
]);

// Normalize ingredient name for combining
function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
}

// Check if ingredient is a pantry item that should be skipped
function isPantryItem(ingredientName: string): boolean {
  const normalized = normalizeItemName(ingredientName);
  return PANTRY_ITEMS.has(normalized);
}

// Get unique key for item grouping
function getItemKey(item: ShoppingItem): string {
  return `${normalizeItemName(item.name)}:${item.unit}`;
}

// Combine items with same name + exact unit match
function combineItems(items: ShoppingItem[]): CombinedItem[] {
  const grouped = new Map<string, ShoppingItem[]>();

  // Group items by normalized name + unit
  items.forEach((item) => {
    const key = getItemKey(item);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });

  // Combine grouped items
  const combined: CombinedItem[] = Array.from(grouped.entries()).map(
    ([key, sourceItems]) => {
      // Sum amounts, all must be checked to show as checked
      const totalAmount = sourceItems.reduce(
        (sum, item) => sum + (item.amount || 0),
        0
      );
      const allChecked = sourceItems.every((item) => item.isChecked);
      const someChecked = sourceItems.some((item) => item.isChecked);
      const isIndeterminate = someChecked && !allChecked;

      // Merge tags (deduplicate)
      const allTagIds = [
        ...new Set(sourceItems.flatMap((item) => item.tagIds)),
      ];

      return {
        key,
        name: sourceItems[0].name,
        amount: totalAmount || null,
        unit: sourceItems[0].unit,
        isChecked: allChecked,
        isIndeterminate,
        tagIds: allTagIds,
        sourceItemIds: sourceItems.map((item) => item.id),
      };
    }
  );

  // Sort alphabetically by name
  return combined.sort((a, b) =>
    normalizeItemName(a.name).localeCompare(normalizeItemName(b.name))
  );
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

  // Build recipe groups with titles
  const recipeGroups = Array.from(recipeMap.entries()).map(
    ([recipeId, groupItems]) => {
      const recipe = recipes.find((r) => r.id === recipeId);
      return {
        recipeId,
        recipeTitle: recipe?.title || 'Unknown Recipe',
        items: [...groupItems].sort((a, b) =>
          normalizeItemName(a.name).localeCompare(normalizeItemName(b.name))
        ),
      };
    }
  );

  // Build custom groups with names, sorted by sortOrder (creation time)
  // Include ALL groups from Firestore, even empty ones
  const customGroups = groups
    .map((group) => {
      const groupItemsList = customGroupMap.get(group.id) || [];
      return {
        groupId: group.id,
        groupName: group.displayName,
        sortOrder: group.sortOrder,
        items: [...groupItemsList].sort((a, b) =>
          normalizeItemName(a.name).localeCompare(normalizeItemName(b.name))
        ),
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ groupId, groupName, items }) => ({ groupId, groupName, items }));

  // Sort manual items alphabetically (create copy to avoid mutating)
  const sortedManualItems = [...manualItems].sort((a, b) =>
    normalizeItemName(a.name).localeCompare(normalizeItemName(b.name))
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
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [loadingRecipes, setLoadingRecipes] = useState<Map<string, string>>(new Map()); // recipeId -> recipeTitle

  // Tag dialog state
  const [tagDialogItemKey, setTagDialogItemKey] = useState<string | null>(null);

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

  // Filter items by selected tags
  const filteredItems = useMemo(() => {
    if (selectedTagIds.length === 0) return items;
    return items.filter(
      (item) =>
        item.tagIds.length === 0 ||
        item.tagIds.some((id) => selectedTagIds.includes(id))
    );
  }, [items, selectedTagIds]);

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
      items
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
  }, [items, groups]);

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

  // Navigate to edit screen
  const handleItemClick = useCallback(
    (itemId: string, isCombined: boolean) => {
      // In simple mode (combined), edit all related items
      // In grouped mode (not combined), edit only this specific item
      navigate(`/shopping/edit/${itemId}${isCombined ? '' : '?single=true'}`);
    },
    [navigate]
  );

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

          // Check if this recipe needs AI parsing
          const recipeWithMetadata = recipe as RecipeWithAiMetadata;
          const needsAiParsing = getIngredientsNeedingAiIndices(
            recipeWithMetadata.ingredients,
            recipeWithMetadata.lastAiParsingVersion
          ).length > 0;

          // Only show loading state if AI parsing is needed
          if (needsAiParsing) {
            setLoadingRecipes((prev) => new Map(prev).set(recipeId, recipe.title));
          }

          // Ensure AI parsing is done before adding to shopping list
          const ingredientsToAdd = await ensureRecipeHasAiParsingAndUpdate(
            recipeWithMetadata,
            dispatch
          );

          // Get existing items from this recipe to avoid duplicates
          const existingRecipeItems = items.filter(
            (item) => item.sourceRecipeId === recipeId
          );
          const existingNames = new Set(
            existingRecipeItems.map((item) => normalizeItemName(item.name))
          );

          let addedCount = 0;

          // Add ingredients to shopping list one by one
          for (const ingredient of ingredientsToAdd) {
            const { amount, unit, name } = getEffectiveIngredientValues(ingredient);

            // Skip pantry items (water, salt, pepper, etc.)
            if (isPantryItem(name)) {
              continue;
            }

            // Skip if already exists from this recipe
            if (existingNames.has(normalizeItemName(name))) {
              continue;
            }

            await addShoppingItem({
              familyId: FAMILY_ID,
              name,
              amount,
              unit,
              isChecked: false,
              tagIds: [],
              sourceRecipeId: recipeId,
            });
            addedCount++;

            // Remove loading state after first item is added
            if (addedCount === 1) {
              setLoadingRecipes((prev) => {
                const next = new Map(prev);
                next.delete(recipeId);
                return next;
              });
            }
          }

          // Remove loading state if no items were added
          setLoadingRecipes((prev) => {
            const next = new Map(prev);
            next.delete(recipeId);
            return next;
          });

          // Notify user if nothing was added (recipe already fully on list)
          if (addedCount === 0 && ingredientsToAdd.length > 0) {
            alert(`"${recipe.title}" is already on your shopping list.`);
          }
        }
      } catch (error) {
        console.error('Error adding recipes:', error);
        alert('Failed to add recipes');
        // Clear all loading states on error
        setLoadingRecipes(new Map());
      }
    },
    [recipes, items, dispatch]
  );

  // Toggle tag for item(s)
  const handleItemTagToggle = useCallback(
    async (itemIds: string[], tagId: string) => {
      try {
        for (const id of itemIds) {
          const item = items.find((i) => i.id === id);
          if (!item) continue;

          const newTagIds = item.tagIds.includes(tagId)
            ? item.tagIds.filter((tid) => tid !== tagId)
            : [...item.tagIds, tagId];

          await updateShoppingItem(id, { tagIds: newTagIds });
        }
        // Close dialog after toggle
        setTagDialogItemKey(null);
      } catch (error) {
        console.error('Error updating tags:', error);
      }
    },
    [items]
  );

  // Inline editing state for custom group names
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const editingInputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
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
    setEditingGroupId(null);
    setEditingGroupName('');
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
        tagDialogItemKey={tagDialogItemKey}
        setTagDialogItemKey={setTagDialogItemKey}
        handleItemClick={handleItemClick}
        handleCheck={handleCheck}
        handleItemTagToggle={handleItemTagToggle}
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
            <button
              className={styles.headerAddButton}
              onClick={() => navigate('/shopping/edit/add')}
              aria-label="Add item"
            >
              <i className="fa-solid fa-plus" />
            </button>
            <div className={styles.menuContainer} ref={menuRef}>
              <button
                className={styles.menuButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
              >
                <i className="fa-solid fa-ellipsis-vertical" />
              </button>
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
                    <i className="fa-solid fa-tag" /> {tags.length === 0 ? 'New Tag' : 'Edit Tags'}
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

      {/* Empty state - Simple view: show when no items (groups don't matter) */}
      {items.length === 0 && viewMode === 'simple' && (
        <div className={styles.empty}>
          <p>No items yet</p>
          <p>Add items manually or from your recipes</p>
        </div>
      )}

      {/* Empty state - Grouped view: show when no items AND no groups */}
      {items.length === 0 && groups.length === 0 && viewMode === 'recipe-grouped' && (
        <div className={styles.empty}>
          <p>No items yet</p>
          <p>Add items manually or from your recipes</p>
        </div>
      )}

      {/* Item list - Simple view */}
      {items.length > 0 && viewMode === 'simple' && (
        <div className={styles.itemList}>
          {combinedItems.map((item) => renderItem(item, true))}
        </div>
      )}

      {/* Item list - Recipe grouped view */}
      {(items.length > 0 || groups.length > 0) && viewMode === 'recipe-grouped' && (
        <div>

          {/* Manual items - shown directly without a header */}
          {groupedItems.manualItems.length > 0 && (
            <div className={styles.manualItemsSection}>
              <div className={styles.itemList}>
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
                {editingGroupId === group.groupId ? (
                  <input
                    ref={editingInputRef}
                    type="text"
                    className={styles.editableGroupNameInput}
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onBlur={handleSaveGroupName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveGroupName();
                      } else if (e.key === 'Escape') {
                        handleCancelEditGroupName();
                      }
                    }}
                  />
                ) : (
                  <div
                    className={styles.recipeGroupHeaderContent}
                    onClick={() => toggleGroupCollapse(group.groupId)}
                  >
                    <Checkbox
                      checked={getGroupCheckedState(group.items, group.groupId) === 'all'}
                      indeterminate={getGroupCheckedState(group.items, group.groupId) === 'some'}
                      onChange={() => handleGroupCheckToggle(group.items, group.groupId)}
                      className={styles.groupCheckboxLeft}
                    />
                    <span
                      className={styles.editableGroupName}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditGroupName(group.groupId, group.groupName);
                      }}
                    >
                      {group.groupName}
                    </span>
                    <button
                      className={styles.groupAddButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/shopping/edit/add?groupId=${group.groupId}`);
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
                )}
              </div>
              {!collapsedGroups.has(group.groupId) && (
                <div className={styles.itemList}>
                  {group.items.map((item) => renderItem(item, false))}
                </div>
              )}
            </div>
          ))}
          
          {/* Loading recipe groups (shown while AI parsing / adding items) */}
          {Array.from(loadingRecipes.entries()).map(([recipeId, recipeTitle]) => (
            <div key={`loading-${recipeId}`} className={styles.recipeGroup}>
              <div className={styles.recipeGroupHeader}>
                <div className={styles.recipeGroupHeaderContent}>
                  <i className="fa-solid fa-caret-down" style={{ opacity: 0.3 }} />
                  From "{recipeTitle}"
                </div>
              </div>
              <div className={styles.itemList}>
                <div className={styles.loadingItem}>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>Loading ingredients...</span>
                </div>
              </div>
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
                  <Checkbox
                    checked={getGroupCheckedState(group.items) === 'all'}
                    indeterminate={getGroupCheckedState(group.items) === 'some'}
                    onChange={() => handleGroupCheckToggle(group.items)}
                    className={styles.groupCheckboxLeft}
                  />
                  <span className={styles.groupTitle}>From "{group.recipeTitle}"</span>
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

      {/* Modal backdrop for tag dialog */}
      {tagDialogItemKey && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setTagDialogItemKey(null)}
        />
      )}
    </div>
  );
};

export default Shopping;
