import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { setShoppingItems, setStores, removeShoppingItems } from './slice';
import {
  subscribeToShoppingItems,
  subscribeToStores,
  initializeDefaultStores,
  addShoppingItem,
  updateShoppingItem,
  bulkDeleteShoppingItems,
} from '../../firebase/firestore';
import { UnitValue } from '../../types';
import type { ShoppingItem, Store, CombinedItem, GroupedItems, Recipe } from '../../types';
type UnitValueType = typeof UnitValue[keyof typeof UnitValue];
import RecipePicker from '../../common/components/RecipePicker';
import styles from './shopping.module.css';

const FAMILY_ID = 'default-family';

// Unit labels for display
const UNIT_LABELS: Record<string, string> = {
  [UnitValue.CUP]: 'cup',
  [UnitValue.TABLESPOON]: 'tbsp',
  [UnitValue.TEASPOON]: 'tsp',
  [UnitValue.FLUID_OUNCE]: 'fl oz',
  [UnitValue.QUART]: 'qt',
  [UnitValue.POUND]: 'lb',
  [UnitValue.OUNCE]: 'oz',
  [UnitValue.EACH]: 'ea',
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

// Normalize ingredient name for combining
function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
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

// Format amount and unit for display
function formatAmount(amount: number | null, unit: string | null): string {
  if (!amount && !unit) return '';
  const unitLabel = unit ? UNIT_LABELS[unit] || unit.toLowerCase() : '';
  if (!amount) return unitLabel;
  return `${amount} ${unitLabel}`.trim();
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

  const [viewMode, setViewMode] = useState<'simple' | 'recipe-grouped'>(
    'simple'
  );
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Manual item entry state
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemUnit, setNewItemUnit] = useState<UnitValueType | ''>('');
  const [isAdding, setIsAdding] = useState(false);

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
    setSelectedStoreIds((prev) =>
      prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId]
    );
  }, []);

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
  const handleAddItem = useCallback(async () => {
    if (!newItemName.trim()) return;

    setIsAdding(true);
    try {
      await addShoppingItem({
        familyId: FAMILY_ID,
        name: newItemName.trim(),
        amount: newItemAmount ? parseFloat(newItemAmount) : null,
        unit: newItemUnit || null,
        isChecked: false,
        storeTagIds: [],
      });

      // Clear form
      setNewItemName('');
      setNewItemAmount('');
      setNewItemUnit('');
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Failed to add item');
    } finally {
      setIsAdding(false);
    }
  }, [newItemName, newItemAmount, newItemUnit]);

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
    (itemId: string) => {
      navigate(`/shopping/edit/${itemId}`);
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

          for (const ingredient of recipe.ingredients) {
            await addShoppingItem({
              familyId: FAMILY_ID,
              name: ingredient.name,
              amount: ingredient.amount,
              unit: ingredient.unit,
              isChecked: false,
              storeTagIds: [],
              sourceRecipeId: recipeId,
            });
          }
        }
      } catch (error) {
        console.error('Error adding recipes:', error);
        alert('Failed to add recipes');
      }
    },
    [recipes]
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
      <div className={styles.header}>
        <h1>Shopping List</h1>
        <div className={styles.headerButtons}>
          <button
            className={styles.primaryButton}
            onClick={() => setShowRecipePicker(true)}
          >
            <i className="fa-solid fa-plus" /> Add Recipes
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewButton} ${viewMode === 'simple' ? styles.viewButtonActive : ''}`}
            onClick={() => setViewMode('simple')}
          >
            Simple
          </button>
          <button
            className={`${styles.viewButton} ${viewMode === 'recipe-grouped' ? styles.viewButtonActive : ''}`}
            onClick={() => setViewMode('recipe-grouped')}
          >
            By Recipe
          </button>
        </div>

        {stores.length > 0 && (
          <div className={styles.storeFilter}>
            <span className={styles.storeFilterLabel}>Stores:</span>
            {[...stores]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((store) => (
                <button
                  key={store.id}
                  className={`${styles.storeTag} ${
                    selectedStoreIds.includes(store.id)
                      ? styles.storeTagSelected
                      : ''
                  }`}
                  style={{ backgroundColor: store.color, color: 'white' }}
                  onClick={() => handleStoreToggle(store.id)}
                >
                  {store.abbreviation}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Add item form */}
      <div className={styles.addItemSection}>
        <form
          className={styles.addItemForm}
          onSubmit={(e) => {
            e.preventDefault();
            handleAddItem();
          }}
        >
          <input
            type="number"
            className={`${styles.addItemInput} ${styles.amountInput}`}
            placeholder="Qty"
            value={newItemAmount}
            onChange={(e) => setNewItemAmount(e.target.value)}
            min="0"
            step="any"
          />
          <select
            className={styles.unitSelect}
            value={newItemUnit}
            onChange={(e) => setNewItemUnit(e.target.value as UnitValueType | '')}
          >
            <option value="">No unit</option>
            {Object.entries(UNIT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className={styles.addItemInput}
            placeholder="Add item..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
          <button
            type="submit"
            className={styles.addItemButton}
            disabled={!newItemName.trim() || isAdding}
          >
            Add
          </button>
        </form>
      </div>

      {/* Actions bar */}
      {items.length > 0 && (
        <div className={styles.actionsBar}>
          <span className={styles.itemCount}>
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
            {selectedStoreIds.length > 0 && ` (filtered)`}
          </span>
          <button
            className={styles.bulkDeleteButton}
            onClick={handleBulkDelete}
            disabled={checkedItemIds.length === 0}
          >
            <i className="fa-solid fa-trash" /> Delete Checked (
            {checkedItemCount})
          </button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className={styles.empty}>
          <p>No items yet</p>
          <p>Add items manually or from your recipes</p>
          <div className={styles.emptyActions}>
            <button
              className={styles.primaryButton}
              onClick={() => setShowRecipePicker(true)}
            >
              Add from Recipes
            </button>
          </div>
        </div>
      )}

      {/* Item list - Simple view */}
      {items.length > 0 && viewMode === 'simple' && (
        <div className={styles.itemList}>
          {combinedItems.map((item) => renderItem(item, true))}
        </div>
      )}

      {/* Item list - Recipe grouped view */}
      {items.length > 0 && viewMode === 'recipe-grouped' && (
        <div>
          {/* Manual items first */}
          {groupedItems.manualItems.length > 0 && (
            <div className={styles.recipeGroup}>
              <div
                className={styles.recipeGroupHeader}
                onClick={() => toggleGroupCollapse('manual')}
              >
                <i
                  className={`fa-solid fa-caret-${collapsedGroups.has('manual') ? 'right' : 'down'} ${styles.groupCaret}`}
                />
                Non-Recipe Items
              </div>
              {!collapsedGroups.has('manual') && (
                <div className={styles.itemList}>
                  {groupedItems.manualItems.map((item) =>
                    renderItem(item, false)
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Recipe groups */}
          {groupedItems.recipeGroups.map((group) => (
            <div key={group.recipeId} className={styles.recipeGroup}>
              <div
                className={styles.recipeGroupHeader}
                onClick={() => toggleGroupCollapse(group.recipeId)}
              >
                <i
                  className={`fa-solid fa-caret-${collapsedGroups.has(group.recipeId) ? 'right' : 'down'} ${styles.groupCaret}`}
                />
                {group.recipeTitle}
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

      {/* Backdrop for store dialog */}
      {storeDialogItemKey && (
        <div
          className={styles.dialogBackdrop}
          onClick={() => setStoreDialogItemKey(null)}
        />
      )}
    </div>
  );
};

// Separate component for individual item row to use hooks
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
                <div className={styles.storeDialog} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.storeDialogContent}>
                    {[...stores]
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((store) => {
                        const isSelected = item.storeTagIds.includes(store.id);
                        return (
                          <button
                            key={store.id}
                            className={`${styles.storeDialogOption} ${
                              isSelected ? styles.storeDialogOptionSelected : ''
                            }`}
                            style={{
                              backgroundColor: isSelected ? store.color : `${store.color}15`,
                              color: isSelected ? 'white' : store.color,
                            }}
                            onClick={() => handleItemStoreToggle(itemIds, store.id)}
                          >
                            {store.displayName}
                          </button>
                        );
                      })}
                  </div>
                </div>
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

export default Shopping;
