import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAppSelector, useAppDispatch, useDebugMode, useNavigateWithDebug, appendDebugToPath } from '../../common/hooks';
import { 
  addShoppingItem,
  updateShoppingItem,
  subscribeToShoppingItems,
  subscribeToTags,
} from '../../firebase/firestore';
import { setShoppingItems, setTags } from './slice';
import CircleIconButton from '../../common/components/CircleIconButton';
import ParsedFieldsDebug from '../../common/components/ParsedFieldsDebug';
import { parseShoppingItemText } from '../../common/aiParsing';
import { UnitValue } from '../../types';
import type { ShoppingItem, Tag } from '../../types';
type UnitValueType = typeof UnitValue[keyof typeof UnitValue];
import styles from './editShoppingItem.module.css';

const FAMILY_ID = 'default-family';

// Normalize ingredient name for combining
function normalizeItemName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Grouping key for aggregating items. Returns null when there's no parsed name
 * (e.g. parse failed) - those items never group with anything.
 */
function getItemKey(item: ShoppingItem): string | null {
  if (!item.name?.trim()) return null;
  return `${normalizeItemName(item.name)}:${item.unit}`;
}

// Local state: single originalText input per item
interface EditableItem {
  id: string;
  originalText: string;
  tagIds: string[];
  sourceRecipeId?: string;
}

const EditShoppingItem = () => {
  const navigate = useNavigateWithDebug();
  const dispatch = useAppDispatch();
  const { itemId } = useParams<{ itemId: string }>();
  const [searchParams] = useSearchParams();
  const editSingleOnly = searchParams.get('single') === 'true';
  const customGroupId = searchParams.get('groupId') || undefined;
  const isAddMode = itemId === 'add';
  const allItems: ShoppingItem[] = useAppSelector((state) => state.shopping?.items || []);
  const tags: Tag[] = useAppSelector((state) => state.shopping?.tags || []);
  const recipes = useAppSelector((state) => state.recipes?.recipes || []);
  const loading = useAppSelector((state) => state.shopping?.loading ?? true);

  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const debugMode = useDebugMode();

  // Set up real-time listeners (in case user navigates directly to edit page)
  useEffect(() => {
    // Set up real-time listeners
    const unsubItems = subscribeToShoppingItems(FAMILY_ID, (newItems) => {
      dispatch(setShoppingItems(newItems));
    });

    const unsubTags = subscribeToTags(FAMILY_ID, (newTags) => {
      dispatch(setTags(newTags));
    });

    return () => {
      unsubItems();
      unsubTags();
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
    if (editSingleOnly) return [clickedItem];
    const key = getItemKey(clickedItem);
    if (key === null) return [clickedItem];
    return allItems.filter((i) => getItemKey(i) === key);
  }, [allItems, clickedItem, editSingleOnly, isAddMode]);

  // Initialize editable state from items
  useEffect(() => {
    if (isAddMode) {
      setEditableItems([{ id: 'new', originalText: '', tagIds: [] }]);
      setHasChanges(false);
    } else if (relatedItems.length > 0) {
      setEditableItems(
        relatedItems.map((item) => ({
          id: item.id,
          originalText: item.originalText ?? '',
          tagIds: [...item.tagIds],
          sourceRecipeId: item.sourceRecipeId,
        }))
      );
      setHasChanges(false);
    }
  }, [relatedItems, isAddMode]);

  const handleOriginalTextChange = useCallback((itemId: string, value: string) => {
    setEditableItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, originalText: value } : item))
    );
    setHasChanges(true);
  }, []);

  // Toggle tag for an item
  const handleTagToggle = useCallback((itemId: string, tagId: string) => {
    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const newTagIds = item.tagIds.includes(tagId)
          ? item.tagIds.filter((id) => id !== tagId)
          : [...item.tagIds, tagId];
        return { ...item, tagIds: newTagIds };
      })
    );
    setHasChanges(true);
  }, []);

  // Save all changes. Parses originalText via API to get amount/unit/name.
  // Open question: when to send to AI parsing? (on save, on blur, debounced, etc.)
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

      navigate('/shopping');
    } catch (error) {
      console.error('Error saving items:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [editableItems, relatedItems, navigate, isAddMode, customGroupId]);

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
          <Link to={appendDebugToPath('/shopping', debugMode)} className={styles.backLink}>
            Back to Shopping List
          </Link>
        </div>
      </div>
    );
  }

  const isSaveDisabled = isSaving || (isAddMode
    ? !editableItems[0]?.originalText?.trim()
    : !hasChanges);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <CircleIconButton
          icon="fa-angle-left"
          onClick={handleBack}
          ariaLabel="Back to shopping list"
        />
        <h1>{isAddMode ? 'Add Item' : 'Edit Item'}</h1>
        <CircleIconButton
          icon={isSaving ? "fa-circle-notch fa-spin" : "fa-check"}
          onClick={handleSave}
          disabled={isSaveDisabled}
          ariaLabel="Save"
        />
      </header>

      {editableItems.map((item) => {
        const sourceItem = relatedItems.find((i) => i.id === item.id);
        return (
          <div key={item.id} className={styles.sourceItem}>
            <div className={styles.formGroup}>
              <input
                type="text"
                className={styles.input}
                value={item.originalText}
                onChange={(e) => handleOriginalTextChange(item.id, e.target.value)}
                placeholder="e.g. 2 cups flour, 3 carrots"
              />
            </div>
            {debugMode && sourceItem && (
              <ParsedFieldsDebug
                amount={sourceItem.amount}
                unit={sourceItem.unit}
                name={sourceItem.name ?? ''}
              />
            )}

            <div className={styles.tagsSection}>
              <div className={styles.tags}>
                {[...tags]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className={`${styles.tag} ${
                        item.tagIds.includes(tag.id) ? styles.tagSelected : ''
                      }`}
                      style={{ backgroundColor: tag.color }}
                      onClick={() => handleTagToggle(item.id, tag.id)}
                    >
                      {tag.displayName}
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
        );
      })}
    </div>
  );
};

export default EditShoppingItem;
