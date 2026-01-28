import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { setShoppingItems, setStores, removeShoppingItems, setViewMode, setSelectedStoreIds } from './slice';
import {
  subscribeToShoppingItems,
  subscribeToStores,
  initializeDefaultStores,
  addShoppingItem,
  updateShoppingItem,
  bulkDeleteShoppingItems,
} from '../../firebase/firestore';
import type { ShoppingItem, Store, CombinedItem, GroupedItems, Recipe } from '../../types';
import { ensureRecipeHasAiParsingAndUpdate, getEffectiveIngredientValues } from '../../common/aiParsing';
import type { RecipeWithAiMetadata } from '../../common/aiParsing';
import { getIngredientsNeedingAiIndices } from '../../common/aiParsing';
import RecipePicker from '../../common/components/RecipePicker';
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

      // Merge store tags (deduplicate)
      const allStoreTagIds = [
        ...new Set(sourceItems.flatMap((item) => item.storeTagIds)),
      ];

      return {
        key,
        name: sourceItems[0].name,
        amount: totalAmount || null,
        unit: sourceItems[0].unit,
        isChecked: allChecked,
        isIndeterminate,
        storeTagIds: allStoreTagIds,
        sourceItemIds: sourceItems.map((item) => item.id),
      };
    }
  );

  // Sort alphabetically by name
  return combined.sort((a, b) =>
    normalizeItemName(a.name).localeCompare(normalizeItemName(b.name))
  );
}

// Group items by recipe source
function groupByRecipe(items: ShoppingItem[], recipes: Recipe[]): GroupedItems {
  const recipeMap = new Map<string, ShoppingItem[]>();
  const manualItems: ShoppingItem[] = [];

  items.forEach((item) => {
    if (item.sourceRecipeId) {
      if (!recipeMap.has(item.sourceRecipeId)) {
        recipeMap.set(item.sourceRecipeId, []);
      }
      recipeMap.get(item.sourceRecipeId)!.push(item);
    } else {
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

  // Sort manual items alphabetically (create copy to avoid mutating)
  const sortedManualItems = [...manualItems].sort((a, b) =>
    normalizeItemName(a.name).localeCompare(normalizeItemName(b.name))
  );

  return { recipeGroups, manualItems: sortedManualItems };
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
  const stores: Store[] = useAppSelector((state) => state.shopping?.stores || []);
  const loading = useAppSelector((state) => state.shopping?.loading ?? true);
  const recipes: Recipe[] = useAppSelector((state) => state.recipes?.recipes || []);
  const viewMode = useAppSelector((state) => state.shopping?.viewMode || 'simple');
  const selectedStoreIds = useAppSelector((state) => state.shopping?.selectedStoreIds || []);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loadingRecipes, setLoadingRecipes] = useState<Map<string, string>>(new Map()); // recipeId -> recipeTitle

  // Store tag dialog state
  const [storeDialogItemKey, setStoreDialogItemKey] = useState<string | null>(null);

  // Set up real-time listeners
  useEffect(() => {
    let unsubItems: (() => void) | undefined;
    let unsubStores: (() => void) | undefined;

    const initAndSubscribe = async () => {
      try {
        // Initialize default stores (safe to call multiple times)
        await initializeDefaultStores(FAMILY_ID);

        // Set up real-time listeners
        unsubItems = subscribeToShoppingItems(FAMILY_ID, (newItems) => {
          dispatch(setShoppingItems(newItems));
        });

        unsubStores = subscribeToStores(FAMILY_ID, (newStores) => {
          dispatch(setStores(newStores));
        });
      } catch (error) {
        console.error('Error initializing shopping list:', error);
        // Set loading to false to show empty state instead of infinite loading
        dispatch(setShoppingItems([]));
        dispatch(setStores([]));
      }
    };

    initAndSubscribe();

    return () => {
      if (unsubItems) unsubItems();
      if (unsubStores) unsubStores();
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

  // Filter items by selected stores
  const filteredItems = useMemo(() => {
    if (selectedStoreIds.length === 0) return items;
    return items.filter(
      (item) =>
        item.storeTagIds.length === 0 ||
        item.storeTagIds.some((id) => selectedStoreIds.includes(id))
    );
  }, [items, selectedStoreIds]);

  // Prepare display items based on view mode
  const combinedItems = useMemo(() => {
    return combineItems(filteredItems);
  }, [filteredItems]);

  const groupedItems = useMemo(() => {
    return groupByRecipe(filteredItems, recipes);
  }, [filteredItems, recipes]);

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

  // Toggle store filter
  const handleStoreToggle = useCallback((storeId: string) => {
    const newSelectedStoreIds = selectedStoreIds.includes(storeId)
      ? selectedStoreIds.filter((id) => id !== storeId)
      : [...selectedStoreIds, storeId];
    dispatch(setSelectedStoreIds(newSelectedStoreIds));
  }, [selectedStoreIds, dispatch]);

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

  // Add manual item
  // Bulk delete checked items
  const handleBulkDelete = useCallback(async () => {
    if (checkedItemIds.length === 0) return;

    if (
      !window.confirm(
        `Delete ${checkedItemIds.length} checked item${checkedItemIds.length > 1 ? 's' : ''}?`
      )
    ) {
      return;
    }

    try {
      // Optimistic update
      dispatch(removeShoppingItems(checkedItemIds));
      await bulkDeleteShoppingItems(checkedItemIds);
    } catch (error) {
      console.error('Error deleting items:', error);
      // Real-time listener will restore correct state on error
    }
  }, [checkedItemIds, dispatch]);

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
              storeTagIds: [],
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

  // Toggle store tag for item(s)
  const handleItemStoreToggle = useCallback(
    async (itemIds: string[], storeId: string) => {
      try {
        for (const id of itemIds) {
          const item = items.find((i) => i.id === id);
          if (!item) continue;

          const newStoreTagIds = item.storeTagIds.includes(storeId)
            ? item.storeTagIds.filter((sid) => sid !== storeId)
            : [...item.storeTagIds, storeId];

          await updateShoppingItem(id, { storeTagIds: newStoreTagIds });
        }
        // Close dialog after toggle
        setStoreDialogItemKey(null);
      } catch (error) {
        console.error('Error updating store tags:', error);
      }
    },
    [items]
  );

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
        stores={stores}
        storeDialogItemKey={storeDialogItemKey}
        setStoreDialogItemKey={setStoreDialogItemKey}
        handleItemClick={handleItemClick}
        handleCheck={handleCheck}
        handleItemStoreToggle={handleItemStoreToggle}
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
                    className={`${styles.menuItem} ${checkedItemIds.length === 0 ? styles.menuItemDisabled : ''}`}
                    onClick={() => {
                      if (checkedItemIds.length > 0) {
                        handleBulkDelete();
                        setShowMenu(false);
                      }
                    }}
                    disabled={checkedItemIds.length === 0}
                  >
                    <i className="fa-solid fa-trash" /> Delete Checked{checkedItemIds.length > 0 ? ` (${checkedItemCount})` : ''}
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

          {stores.length > 0 && (
            <div className={styles.storeFilter}>
              {[...stores]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((store) => (
                  <div
                    key={store.id}
                    className={styles.storeTagWrapper}
                    onClick={() => handleStoreToggle(store.id)}
                  >
                    <button
                      className={`${styles.storeTag} ${
                        selectedStoreIds.includes(store.id)
                          ? styles.storeTagSelected
                          : ''
                      }`}
                      style={{ backgroundColor: store.color, color: 'white' }}
                    >
                      {store.abbreviation}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <>
          <div className={styles.addItemSection}>
            <button
              className={styles.addItemButton}
              onClick={() => navigate('/shopping/edit/add')}
            >
              + Add Item
            </button>
          </div>
          <div className={styles.empty}>
            <p>No items yet</p>
            <p>Add items manually or from your recipes</p>
          </div>
        </>
      )}

      {/* Item list - Simple view */}
      {items.length > 0 && viewMode === 'simple' && (
        <>
          <div className={styles.addItemSection}>
            <button
              className={styles.addItemButton}
              onClick={() => navigate('/shopping/edit/add')}
            >
              + Add Item
            </button>
          </div>
          <div className={styles.itemList}>
            {combinedItems.map((item) => renderItem(item, true))}
          </div>
        </>
      )}

      {/* Item list - Recipe grouped view */}
      {items.length > 0 && viewMode === 'recipe-grouped' && (
        <div>
          {/* Manual items first */}
          <div className={styles.recipeGroup}>
            <div className={styles.recipeGroupHeader}>
              <div 
                className={styles.recipeGroupHeaderContent}
                onClick={() => toggleGroupCollapse('manual')}
              >
                <i
                  className={`fa-solid fa-caret-${collapsedGroups.has('manual') ? 'right' : 'down'} ${styles.groupCaret}`}
                />
                Non-Recipe Items
              </div>
              <button
                className={styles.addItemButton}
                onClick={() => navigate('/shopping/edit/add')}
              >
                + Add Item
              </button>
            </div>
            {!collapsedGroups.has('manual') && (
              <div className={styles.itemList}>
                {groupedItems.manualItems.map((item) =>
                  renderItem(item, false)
                )}
              </div>
            )}
          </div>
          
          {/* Loading recipe groups (shown while AI parsing / adding items) */}
          {Array.from(loadingRecipes.entries()).map(([recipeId, recipeTitle]) => (
            <div key={`loading-${recipeId}`} className={styles.recipeGroup}>
              <div className={styles.recipeGroupHeader}>
                <div className={styles.recipeGroupHeaderContent}>
                  <i className="fa-solid fa-caret-down" style={{ opacity: 0.3 }} />
                  {recipeTitle}
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
                  <i
                    className={`fa-solid fa-caret-${collapsedGroups.has(group.recipeId) ? 'right' : 'down'} ${styles.groupCaret}`}
                  />
                  {group.recipeTitle}
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

      {/* Modal backdrop for store dialog */}
      {storeDialogItemKey && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setStoreDialogItemKey(null)}
        />
      )}
    </div>
  );
};

export default Shopping;
