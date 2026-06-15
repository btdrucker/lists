import { useState, useEffect, useRef } from 'react';
import { useAppDispatch } from '../../common/hooks';
import { setViewMode, setSelectedTagIds } from './slice';
import { signOut } from '../../firebase/auth';
import CircleIconButton from '../../common/components/CircleIconButton';
import type { Tag } from '../../types';
import styles from './shopping.module.css';

interface ShoppingHeaderProps {
  onAddNewItem: () => void;
  onAddRecipes: () => void;
  onAddGroup: () => void;
  onEditTags: () => void;
  onBulkDelete: () => void;
  canBulkDelete: boolean;
  checkedItemCount: number;
  checkedGroupCount: number;
  viewMode: 'simple' | 'recipe-grouped';
  tags: Tag[];
  selectedTagIds: string[];
}

export function ShoppingHeader({
  onAddNewItem,
  onAddRecipes,
  onAddGroup,
  onEditTags,
  onBulkDelete,
  canBulkDelete,
  checkedItemCount,
  checkedGroupCount,
  viewMode,
  tags,
  selectedTagIds,
}: ShoppingHeaderProps) {
  const dispatch = useAppDispatch();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const deleteLabel = (() => {
    if (checkedItemCount > 0 && checkedGroupCount > 0) {
      return `Delete Checked (${checkedItemCount}) & ${checkedGroupCount} group${checkedGroupCount > 1 ? 's' : ''}`;
    }
    if (checkedItemCount > 0) return `Delete Checked (${checkedItemCount})`;
    if (checkedGroupCount > 0) return `Delete Checked (${checkedGroupCount} group${checkedGroupCount > 1 ? 's' : ''})`;
    return 'Delete Checked';
  })();

  const handleTagToggle = (tagId: string) => {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    dispatch(setSelectedTagIds(next));
  };

  return (
    <div className={styles.stickyHeader}>
      <div className={styles.header}>
        <h1>Shopping List</h1>
        <div className={styles.headerButtons}>
          <CircleIconButton icon="fa-plus" onClick={onAddNewItem} ariaLabel="New item" />
          <div className={styles.menuContainer} ref={menuRef}>
            <CircleIconButton
              icon="fa-ellipsis-vertical"
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              ariaLabel="Shopping list options"
            />
            {showMenu && (
              <div className={styles.menuDropdown}>
                <button
                  className={styles.menuItem}
                  onClick={() => { onAddRecipes(); setShowMenu(false); }}
                >
                  <i className="fa-solid fa-utensils" /> Add Recipe
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => { onAddGroup(); setShowMenu(false); }}
                >
                  <i className="fa-solid fa-folder-plus" /> New Group
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => { onEditTags(); setShowMenu(false); }}
                >
                  <i className="fa-solid fa-tags" /> {tags.length === 0 ? 'New Tag' : 'Edit Tags'}
                </button>
                <button
                  className={`${styles.menuItem} ${styles.menuItemDanger} ${!canBulkDelete ? styles.menuItemDisabled : ''}`}
                  onClick={() => { if (canBulkDelete) { onBulkDelete(); setShowMenu(false); } }}
                  disabled={!canBulkDelete}
                >
                  <i className="fa-solid fa-trash" /> {deleteLabel}
                </button>
                <div className={styles.menuDivider} />
                <button
                  className={`${styles.menuItem} ${styles.menuItemSignOut}`}
                  onClick={async () => {
                    try { await signOut(); setShowMenu(false); }
                    catch (error) { console.error('Error signing out:', error); }
                  }}
                >
                  <i className="fa-solid fa-arrow-right-from-bracket" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

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
            <span className={styles.toggleSlider} />
          </div>
        </label>

        {tags.length > 0 && (
          <div className={styles.tagFilter}>
            {[...tags].sort((a, b) => a.sortOrder - b.sortOrder).map((tag) => (
              <div key={tag.id} className={styles.tagWrapper} onClick={() => handleTagToggle(tag.id)}>
                <button
                  className={`${styles.tag} ${selectedTagIds.includes(tag.id) ? styles.tagSelected : ''}`}
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
  );
}
