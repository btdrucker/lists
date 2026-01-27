import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { 
  addShoppingItem,
  updateShoppingItem,
  subscribeToShoppingItems,
  subscribeToStores,
} from '../../firebase/firestore';
import { setShoppingItems, setStores } from './slice';
import IconButton from '../../common/components/IconButton';
import { UnitValue } from '../../types';
import type { ShoppingItem, Store } from '../../types';
type UnitValueType = typeof UnitValue[keyof typeof UnitValue];
import styles from './editShoppingItem.module.css';

const FAMILY_ID = 'default-family';

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

// Normalize ingredient name for combining
function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
}

// Get unique key for item grouping
function getItemKey(item: ShoppingItem): string {
  return `${normalizeItemName(item.name)}:${item.unit}`;
}

// Local state for editing an item
interface EditableItem {
  id: string;
  amount: string;
  unit: string;
  name: string;
  storeTagIds: string[];
  sourceRecipeId?: string;
}

const EditShoppingItem = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { itemId } = useParams<{ itemId: string }>();
  const [searchParams] = useSearchParams();
  const editSingleOnly = searchParams.get('single') === 'true';
  const isAddMode = itemId === 'add';
  const allItems: ShoppingItem[] = useAppSelector((state) => state.shopping?.items || []);
  const stores: Store[] = useAppSelector((state) => state.shopping?.stores || []);
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  const loading = useAppSelector((state) => state.shopping?.loading ?? true);

  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Set up real-time listeners (in case user navigates directly to edit page)
  useEffect(() => {
    // Set up real-time listeners
    const unsubItems = subscribeToShoppingItems(FAMILY_ID, (newItems) => {
      dispatch(setShoppingItems(newItems));
    });

    const unsubStores = subscribeToStores(FAMILY_ID, (newStores) => {
      dispatch(setStores(newStores));
    });

    return () => {
      unsubItems();
      unsubStores();
    };
  }, [dispatch]);

  // Find the clicked item and all related items
  const clickedItem = useMemo(
    () => isAddMode ? null : allItems.find((i) => i.id === itemId),
    [allItems, itemId, isAddMode]
  );

  const relatedItems = useMemo(() => {
    if (isAddMode) return [];
    if (!clickedItem) return [];
    // If editing single item only (from grouped mode), return just that item
    if (editSingleOnly) return [clickedItem];
    // Otherwise, return all items with the same name+unit (from simple/combined mode)
    const key = getItemKey(clickedItem);
    return allItems.filter((i) => getItemKey(i) === key);
  }, [allItems, clickedItem, editSingleOnly, isAddMode]);

  // Initialize editable state from items
  useEffect(() => {
    if (isAddMode) {
      // Initialize with empty item for add mode
      setEditableItems([{
        id: 'new',
        amount: '',
        unit: '',
        name: '',
        storeTagIds: [],
      }]);
      setHasChanges(false);
    } else if (relatedItems.length > 0) {
      setEditableItems(
        relatedItems.map((item) => ({
          id: item.id,
          amount: item.amount?.toString() || '',
          unit: item.unit || '',
          name: item.name,
          storeTagIds: [...item.storeTagIds],
          sourceRecipeId: item.sourceRecipeId,
        }))
      );
      setHasChanges(false);
    }
  }, [relatedItems, isAddMode]);

  // Update a field for an item
  const handleFieldChange = useCallback(
    (itemId: string, field: keyof EditableItem, value: string | string[]) => {
      setEditableItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item
        )
      );
      setHasChanges(true);
    },
    []
  );

  // Toggle store tag for an item
  const handleStoreToggle = useCallback((itemId: string, storeId: string) => {
    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newStoreTagIds = item.storeTagIds.includes(storeId)
          ? item.storeTagIds.filter((id) => id !== storeId)
          : [...item.storeTagIds, storeId];
        return { ...item, storeTagIds: newStoreTagIds };
      })
    );
    setHasChanges(true);
  }, []);

  // Save all changes
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (isAddMode) {
        // Add new item
        const item = editableItems[0];
        if (!item.name.trim()) {
          alert('Please enter an item name');
          setIsSaving(false);
          return;
        }
        
        await addShoppingItem({
          familyId: FAMILY_ID,
          name: item.name.trim(),
          amount: item.amount ? parseFloat(item.amount) : null,
          unit: (item.unit as UnitValueType) || null,
          isChecked: false,
          storeTagIds: item.storeTagIds,
        });
      } else {
        // Update existing items
        for (const item of editableItems) {
          const original = relatedItems.find((i) => i.id === item.id);
          if (!original) continue;

          // Build updates object only with changed fields
          const updates: Partial<ShoppingItem> = {};

          const newAmount = item.amount ? parseFloat(item.amount) : null;
          if (newAmount !== original.amount) {
            updates.amount = newAmount;
          }

          const newUnit: UnitValueType | null = (item.unit as UnitValueType) || null;
          if (newUnit !== original.unit) {
            updates.unit = newUnit;
          }

          if (item.name !== original.name) {
            updates.name = item.name;
          }

          if (
            JSON.stringify([...item.storeTagIds].sort()) !==
            JSON.stringify([...original.storeTagIds].sort())
          ) {
            updates.storeTagIds = item.storeTagIds;
          }

          // Only update if there are changes
          if (Object.keys(updates).length > 0) {
            await updateShoppingItem(item.id, updates);
          }
        }
      }

      navigate('/shopping');
    } catch (error) {
      console.error('Error saving items:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [editableItems, relatedItems, navigate, isAddMode]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('Discard unsaved changes?')) {
        navigate('/shopping');
      }
    } else {
      navigate('/shopping');
    }
  }, [hasChanges, navigate]);

  // Get recipe title for an item
  const getRecipeTitle = useCallback(
    (recipeId?: string) => {
      if (!recipeId) return null;
      const recipe = recipes.find((r) => r.id === recipeId);
      return recipe?.title || 'Unknown Recipe';
    },
    [recipes]
  );

  if (loading && !isAddMode) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAddMode && !clickedItem) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Item not found</p>
          <p>This item may have been deleted.</p>
          <Link to="/shopping" className={styles.backLink}>
            Back to Shopping List
          </Link>
        </div>
      </div>
    );
  }

  // Determine if save button should be disabled
  const isSaveDisabled = isSaving || (isAddMode 
    ? !editableItems[0]?.name?.trim() 
    : !hasChanges);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <IconButton
          onClick={handleBack}
          icon="fa-angle-left"
          hideTextOnMobile={true}
          className={styles.backButton}
        >
          Done
        </IconButton>
        <h1>{isAddMode ? 'Add Item' : 'Edit Item'}</h1>
        <IconButton
          onClick={handleSave}
          icon="fa-floppy-disk"
          disabled={isSaveDisabled}
          hideTextOnMobile={true}
          className={styles.saveButton}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </IconButton>
      </header>

      {editableItems.map((item) => (
          <div key={item.id} className={styles.sourceItem}>
            <div className={styles.formRow}>
              <div className={styles.formGroupSmall}>
                <label className={styles.label}>Amount</label>
                <input
                  type="number"
                  className={styles.input}
                  value={item.amount}
                  onChange={(e) =>
                    handleFieldChange(item.id, 'amount', e.target.value)
                  }
                  min="0"
                  step="any"
                  placeholder="Qty"
                />
              </div>
              <div className={styles.formGroupMedium}>
                <label className={styles.label}>Unit</label>
                <select
                  className={styles.select}
                  value={item.unit}
                  onChange={(e) =>
                    handleFieldChange(item.id, 'unit', e.target.value)
                  }
                >
                  <option value="">No unit</option>
                  {Object.entries(UNIT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Name</label>
                <input
                  type="text"
                  className={styles.input}
                  value={item.name}
                  onChange={(e) =>
                    handleFieldChange(item.id, 'name', e.target.value)
                  }
                  placeholder="Item name"
                />
              </div>
            </div>

            <div className={styles.storeTagsSection}>
              <div className={styles.storeTags}>
                {[...stores]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      className={`${styles.storeTag} ${
                        item.storeTagIds.includes(store.id)
                          ? styles.storeTagSelected
                          : ''
                      }`}
                      style={{ backgroundColor: store.color }}
                      onClick={() => handleStoreToggle(item.id, store.id)}
                    >
                      {store.displayName}
                    </button>
                  ))}
              </div>
            </div>

            {item.sourceRecipeId && (
              <div className={styles.sourceInfo}>
                From recipe "{getRecipeTitle(item.sourceRecipeId)}"
              </div>
            )}
          </div>
        ))}
    </div>
  );
};

export default EditShoppingItem;
