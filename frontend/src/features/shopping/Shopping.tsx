import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch, useAddRecipeToCart } from '../../common/hooks';
import { removeShoppingItems } from './slice';
import { bulkDeleteShoppingItems, deleteShoppingGroup, updateShoppingItem } from '../../firebase/firestore';
import type { ShoppingItem, Tag, ShoppingGroup, CombinedItem, Recipe } from '../../types';
import { combineItems, groupItems, isItemIndeterminate, getItemIds } from './shopping-utils';
import { useShoppingSubscriptions } from './useShoppingSubscriptions';
import { useShoppingGroupNameEdit } from './useShoppingGroupNameEdit';
import { useShoppingItemActions } from './useShoppingItemActions';
import { useShoppingGroupChecked } from './useShoppingGroupChecked';
import RecipePicker from '../../common/components/RecipePicker';
import EditTagsDialog from './EditTagsDialog';
import ItemTagDialog from './ItemTagDialog';
import ShoppingItemRow from './ShoppingItemRow';
import NewItemRow from './NewItemRow';
import { ShoppingHeader } from './ShoppingHeader';
import { ShoppingGroupedView } from './ShoppingGroupedView';
import styles from './shopping.module.css';

export function Shopping() {
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
  const [loadingRecipeIds, setLoadingRecipeIds] = useState<Map<string, string>>(new Map());
  const prevGroupIdsWithItemsRef = useRef<Set<string>>(new Set());

  useShoppingSubscriptions();
  const groupNameEdit = useShoppingGroupNameEdit();
  const itemActions = useShoppingItemActions(setCollapsedGroups);

  const itemsWithOriginalText = useMemo(
    () => items.filter((i) => (i.originalText ?? '').trim().length > 0),
    [items]
  );

  const filteredItems = useMemo(() => {
    if (selectedTagIds.length === 0) return itemsWithOriginalText;
    return itemsWithOriginalText.filter(
      (item) => item.tagIds.length === 0 || item.tagIds.some((id) => selectedTagIds.includes(id))
    );
  }, [itemsWithOriginalText, selectedTagIds]);

  const combinedItems = useMemo(() => combineItems(filteredItems), [filteredItems]);
  const groupedItems = useMemo(
    () => groupItems(filteredItems, recipes, groups),
    [filteredItems, recipes, groups]
  );

  const { checkedEmptyGroupIds, getGroupCheckedState, handleGroupCheckToggle, fullyCheckedCustomGroupIds } =
    useShoppingGroupChecked(groupedItems);

  // Auto-delete custom groups when their last item is removed
  useEffect(() => {
    const currentGroupIdsWithItems = new Set(
      itemsWithOriginalText
        .filter((item) => item.customGroupId)
        .map((item) => item.customGroupId as string)
    );
    const groupsThatBecameEmpty = [...prevGroupIdsWithItemsRef.current].filter(
      (groupId) => !currentGroupIdsWithItems.has(groupId)
    );
    prevGroupIdsWithItemsRef.current = currentGroupIdsWithItems;

    if (groupsThatBecameEmpty.length === 0) return;
    const deleteEmptyGroups = async () => {
      for (const groupId of groupsThatBecameEmpty) {
        if (groups.some((g) => g.id === groupId)) {
          try { await deleteShoppingGroup(groupId); }
          catch (error) { console.error('Error deleting empty group:', error); }
        }
      }
    };
    deleteEmptyGroups();
  }, [itemsWithOriginalText, groups]);

  const checkedItemIds = useMemo(() => {
    const itemsToCheck = viewMode === 'simple' ? combinedItems : filteredItems;
    return itemsToCheck
      .filter((item) => item.isChecked && !isItemIndeterminate(item))
      .flatMap((item) => getItemIds(item));
  }, [viewMode, combinedItems, filteredItems]);

  const checkedItemCount = useMemo(() => {
    const itemsToCheck = viewMode === 'simple' ? combinedItems : filteredItems;
    return itemsToCheck.filter((item) => item.isChecked && !isItemIndeterminate(item)).length;
  }, [viewMode, combinedItems, filteredItems]);

  const handleCheck = useCallback(async (itemIds: string[], isChecked: boolean) => {
    try {
      for (const id of itemIds) await updateShoppingItem(id, { isChecked });
    } catch (error) {
      console.error('Error updating item:', error);
    }
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const hasItems = checkedItemIds.length > 0;
    const hasGroups = fullyCheckedCustomGroupIds.length > 0;
    if (!hasItems && !hasGroups) return;

    const itemCount = checkedItemIds.length;
    const groupCount = fullyCheckedCustomGroupIds.length;
    const message =
      hasItems && hasGroups
        ? `Delete ${itemCount} checked item${itemCount > 1 ? 's' : ''} and ${groupCount} group${groupCount > 1 ? 's' : ''}?`
        : hasGroups
        ? `Delete ${groupCount} group${groupCount > 1 ? 's' : ''}?`
        : `Delete ${itemCount} checked item${itemCount > 1 ? 's' : ''}?`;

    if (!window.confirm(message)) return;

    try {
      if (hasItems) {
        dispatch(removeShoppingItems(checkedItemIds));
        await bulkDeleteShoppingItems(checkedItemIds);
      }
      for (const groupId of fullyCheckedCustomGroupIds) {
        await deleteShoppingGroup(groupId);
      }
    } catch (error) {
      console.error('Error deleting items:', error);
    }
  }, [checkedItemIds, fullyCheckedCustomGroupIds, dispatch]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }, []);

  const handleRecipesSelected = useCallback(
    async (recipeIds: string[]) => {
      try {
        for (const recipeId of recipeIds) {
          const recipe = recipes.find((r) => r.id === recipeId);
          if (!recipe) continue;
          setLoadingRecipeIds((prev) => new Map(prev).set(recipeId, recipe.title));
          const result = await addRecipeToCart(recipe);
          setLoadingRecipeIds((prev) => { const next = new Map(prev); next.delete(recipeId); return next; });
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

  const renderItem = (item: CombinedItem | ShoppingItem, isCombined: boolean) => {
    const itemIds = getItemIds(item);
    const itemId = itemIds[0];
    const itemKey = isCombined ? (item as CombinedItem).key : (item as ShoppingItem).id;
    return (
      <ShoppingItemRow
        key={itemKey}
        item={item}
        itemId={itemId}
        itemIds={itemIds}
        itemKey={itemKey}
        isIndeterminate={isItemIndeterminate(item)}
        isCombined={isCombined}
        tags={tags}
        handleCheck={handleCheck}
        editingItemId={itemActions.editingItemId}
        editingItemText={itemActions.editingItemText}
        setEditingItemText={itemActions.setEditingItemText}
        onStartEdit={itemActions.handleStartEditItem}
        onSaveEdit={itemActions.handleSaveItemText}
        onCancelEdit={itemActions.handleCancelItemEdit}
        itemEditInputRef={itemActions.editingItemId === itemId ? itemActions.itemEditInputRef : undefined}
        onOpenEditDialog={itemActions.handleOpenEditDialog}
      />
    );
  };

  const canBulkDelete = checkedItemIds.length > 0 || fullyCheckedCustomGroupIds.length > 0;

  if (loading) return <div className={styles.loading}>Loading shopping list...</div>;

  return (
    <div className={`${styles.container} ${styles.pageWithFixedHeader}`}>
      <ShoppingHeader
        onAddNewItem={() => itemActions.handleAddNewItem()}
        onAddRecipes={() => setShowRecipePicker(true)}
        onAddGroup={groupNameEdit.handleAddGroup}
        onEditTags={() => setShowEditTags(true)}
        onBulkDelete={handleBulkDelete}
        canBulkDelete={canBulkDelete}
        checkedItemCount={checkedItemCount}
        checkedGroupCount={fullyCheckedCustomGroupIds.length}
        viewMode={viewMode}
        tags={tags}
        selectedTagIds={selectedTagIds}
      />

      <div className={styles.scrollContent}>
        {items.length === 0 && !itemActions.addingNewItem && viewMode === 'simple' && (
          <div className={styles.empty}>
            <p>No items yet</p>
            <p>Add items manually or from your recipes</p>
          </div>
        )}
        {items.length === 0 && groups.length === 0 && !itemActions.addingNewItem && viewMode === 'recipe-grouped' && (
          <div className={styles.empty}>
            <p>No items yet</p>
            <p>Add items manually or from your recipes</p>
          </div>
        )}

        {(items.length > 0 || itemActions.addingNewItem) && viewMode === 'simple' && (
          <div className={styles.itemList}>
            {itemActions.addingNewItem && !itemActions.newItemGroupId && (
              <NewItemRow
                value={itemActions.newItemText}
                onChange={itemActions.setNewItemText}
                onBlur={itemActions.handleSaveNewItem}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
                  else if (e.key === 'Escape') itemActions.handleCancelNewItem();
                }}
                inputRef={itemActions.itemEditInputRef}
              />
            )}
            {combinedItems.map((item) => renderItem(item, true))}
          </div>
        )}

        {(items.length > 0 || groups.length > 0) && viewMode === 'recipe-grouped' && (
          <ShoppingGroupedView
            groupedItems={groupedItems}
            loadingRecipeIds={loadingRecipeIds}
            collapsedGroups={collapsedGroups}
            toggleGroupCollapse={toggleGroupCollapse}
            groupNameEdit={groupNameEdit}
            newItem={{
              addingNewItem: itemActions.addingNewItem,
              newItemGroupId: itemActions.newItemGroupId,
              newItemText: itemActions.newItemText,
              setNewItemText: itemActions.setNewItemText,
              handleSaveNewItem: itemActions.handleSaveNewItem,
              handleCancelNewItem: itemActions.handleCancelNewItem,
              itemEditInputRef: itemActions.itemEditInputRef,
              handleAddNewItem: itemActions.handleAddNewItem,
            }}
            groupChecked={{ checkedEmptyGroupIds, getGroupCheckedState, handleGroupCheckToggle }}
            renderItem={renderItem}
          />
        )}
      </div>

      <RecipePicker
        isOpen={showRecipePicker}
        onClose={() => setShowRecipePicker(false)}
        onSelect={handleRecipesSelected}
      />
      <EditTagsDialog isOpen={showEditTags} onClose={() => setShowEditTags(false)} />
      <ItemTagDialog
        itemIds={itemActions.editDialogItemIds}
        isOpen={itemActions.editDialogItemIds.length > 0}
        onClose={itemActions.handleCloseEditDialog}
      />
    </div>
  );
}
