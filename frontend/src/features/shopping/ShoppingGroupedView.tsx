import type { ReactNode, RefObject } from 'react';
import type { ShoppingItem, CombinedItem, GroupedItems } from '../../types';
import type { UseShoppingGroupNameEditReturn } from './useShoppingGroupNameEdit';
import Checkbox from '../../common/components/Checkbox';
import CollapseToggle from './CollapseToggle';
import NewItemRow from './NewItemRow';
import styles from './shopping.module.css';

interface NewItemProps {
  addingNewItem: boolean;
  newItemGroupId: string | null;
  newItemText: string;
  setNewItemText: (text: string) => void;
  handleSaveNewItem: () => void;
  handleCancelNewItem: () => void;
  itemEditInputRef: RefObject<HTMLTextAreaElement | null>;
  handleAddNewItem: (groupId?: string) => void;
}

interface GroupCheckedProps {
  checkedEmptyGroupIds: Set<string>;
  getGroupCheckedState: (items: ShoppingItem[], groupId?: string) => 'all' | 'some' | 'none';
  handleGroupCheckToggle: (items: ShoppingItem[], groupId?: string) => Promise<void>;
}

interface ShoppingGroupedViewProps {
  groupedItems: GroupedItems;
  loadingRecipeIds: Map<string, string>;
  collapsedGroups: Set<string>;
  toggleGroupCollapse: (groupId: string) => void;
  groupNameEdit: UseShoppingGroupNameEditReturn;
  newItem: NewItemProps;
  groupChecked: GroupCheckedProps;
  renderItem: (item: CombinedItem | ShoppingItem, isCombined: boolean) => ReactNode;
}

function NewItemRowForGroup({
  newItem,
  groupId,
}: {
  newItem: NewItemProps;
  groupId: string | undefined;
}) {
  const matches = groupId === undefined
    ? !newItem.newItemGroupId
    : newItem.newItemGroupId === groupId;

  if (!newItem.addingNewItem || !matches) return null;

  return (
    <NewItemRow
      value={newItem.newItemText}
      onChange={newItem.setNewItemText}
      onBlur={newItem.handleSaveNewItem}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
        else if (e.key === 'Escape') newItem.handleCancelNewItem();
      }}
      inputRef={newItem.itemEditInputRef}
    />
  );
}

export function ShoppingGroupedView({
  groupedItems,
  loadingRecipeIds,
  collapsedGroups,
  toggleGroupCollapse,
  groupNameEdit,
  newItem,
  groupChecked,
  renderItem,
}: ShoppingGroupedViewProps) {
  const { editingGroupId, editingGroupName, setEditingGroupName, editingInputRef,
    handleStartEditGroupName, handleSaveGroupName, handleCancelEditGroupName } = groupNameEdit;
  const { getGroupCheckedState, handleGroupCheckToggle } = groupChecked;

  return (
    <div>
      {/* Manual items — no group header */}
      {(groupedItems.manualItems.length > 0 || (newItem.addingNewItem && !newItem.newItemGroupId)) && (
        <div className={styles.manualItemsSection}>
          <div className={styles.itemList}>
            <NewItemRowForGroup newItem={newItem} groupId={undefined} />
            {groupedItems.manualItems.map((item) => renderItem(item, false))}
          </div>
        </div>
      )}

      {/* Custom groups */}
      {groupedItems.customGroups.map((group) => {
        const checkedState = getGroupCheckedState(group.items, group.groupId);
        const isCollapsed = collapsedGroups.has(group.groupId);
        const isEditingThis = editingGroupId === group.groupId;

        return (
          <div key={group.groupId} className={styles.recipeGroup}>
            <div className={styles.recipeGroupHeader}>
              <div
                className={styles.recipeGroupHeaderContent}
                onClick={() => { if (!isEditingThis) toggleGroupCollapse(group.groupId); }}
              >
                <Checkbox
                  checked={checkedState === 'all'}
                  indeterminate={checkedState === 'some'}
                  onChange={() => handleGroupCheckToggle(group.items, group.groupId)}
                  className={styles.groupCheckboxLeft}
                />
                <textarea
                  ref={isEditingThis ? editingInputRef : undefined}
                  className={`${styles.editableGroupNameInput} ${checkedState === 'all' ? styles.groupTitleChecked : ''}`}
                  value={isEditingThis ? editingGroupName : group.groupName}
                  readOnly={!isEditingThis}
                  onChange={(e) => setEditingGroupName(e.target.value)}
                  onFocus={() => { if (!isEditingThis) handleStartEditGroupName(group.groupId, group.groupName); }}
                  onBlur={isEditingThis ? handleSaveGroupName : undefined}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (isEditingThis) {
                      if (e.key === 'Enter') { e.preventDefault(); handleSaveGroupName(); }
                      else if (e.key === 'Escape') handleCancelEditGroupName();
                    }
                  }}
                />
                <button
                  className={styles.groupAddButton}
                  onClick={(e) => { e.stopPropagation(); newItem.handleAddNewItem(group.groupId); }}
                  aria-label="New item"
                  title="New item"
                >
                  <i className="fa-solid fa-plus" />
                </button>
                <CollapseToggle
                  collapsed={isCollapsed}
                  onToggle={() => toggleGroupCollapse(group.groupId)}
                />
              </div>
            </div>
            {!isCollapsed && (
              <div className={styles.itemList}>
                <NewItemRowForGroup newItem={newItem} groupId={group.groupId} />
                {group.items.map((item) => renderItem(item, false))}
              </div>
            )}
          </div>
        );
      })}

      {/* Recipe groups */}
      {groupedItems.recipeGroups.map((group) => {
        const checkedState = getGroupCheckedState(group.items);
        const isCollapsed = collapsedGroups.has(group.recipeId);

        return (
          <div key={group.recipeId} className={styles.recipeGroup}>
            <div className={styles.recipeGroupHeader}>
              <div
                className={styles.recipeGroupHeaderContent}
                onClick={() => toggleGroupCollapse(group.recipeId)}
              >
                {loadingRecipeIds.has(group.recipeId) ? (
                  <i
                    className={`fa-solid fa-circle-notch fa-spin ${styles.groupCheckboxLeft} ${checkedState !== 'none' ? styles.groupSpinnerChecked : ''}`}
                  />
                ) : (
                  <Checkbox
                    checked={checkedState === 'all'}
                    indeterminate={checkedState === 'some'}
                    onChange={() => handleGroupCheckToggle(group.items)}
                    className={styles.groupCheckboxLeft}
                  />
                )}
                <span className={`${styles.groupTitle} ${checkedState === 'all' ? styles.groupTitleChecked : ''}`}>
                  From "{group.recipeTitle}"
                </span>
                <CollapseToggle
                  collapsed={isCollapsed}
                  onToggle={() => toggleGroupCollapse(group.recipeId)}
                />
              </div>
            </div>
            {!isCollapsed && (
              <div className={styles.itemList}>
                {group.items.map((item) => renderItem(item, false))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
