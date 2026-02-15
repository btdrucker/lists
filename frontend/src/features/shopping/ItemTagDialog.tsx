import { useAppSelector } from '../../common/hooks';
import { updateShoppingItem } from '../../firebase/firestore';
import Dialog from '../../common/components/Dialog';
import Checkbox from '../../common/components/Checkbox';
import type { ShoppingItem, Tag } from '../../types';
import styles from './editTagsDialog.module.css';

interface ItemTagDialogProps {
  itemIds: string[];
  isOpen: boolean;
  onClose: () => void;
}

const ItemTagDialog = ({ itemIds, isOpen, onClose }: ItemTagDialogProps) => {
  const items: ShoppingItem[] = useAppSelector((state) => state.shopping?.items || []);
  const tags: Tag[] = useAppSelector((state) => state.shopping?.tags || []);

  const sourceItems = itemIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is ShoppingItem => i != null);

  const selectedTagIds = sourceItems.length > 0 ? sourceItems[0].tagIds : [];

  const handleTagChange = async (tagId: string, selected: boolean) => {
    if (sourceItems.length === 0) return;
    const newSelected = selected
      ? [...selectedTagIds, tagId]
      : selectedTagIds.filter((id) => id !== tagId);
    try {
      for (const item of sourceItems) {
        await updateShoppingItem(item.id, { tagIds: newSelected });
      }
    } catch (error) {
      console.error('Error updating item tags:', error);
    }
  };

  if (!isOpen) return null;

  const sortedTags = [...tags].sort((a, b) => b.sortOrder - a.sortOrder);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Tags" maxWidth="sm">
      <div className={styles.tagList}>
        {sortedTags.length === 0 && (
          <div className={styles.emptyState}>
            <p>No tags yet</p>
            <p>Create tags in the menu</p>
          </div>
        )}
        {sortedTags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <div
              key={tag.id}
              className={styles.tagRow}
              onClick={() => handleTagChange(tag.id, !isSelected)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTagChange(tag.id, !isSelected);
                }
              }}
            >
              <Checkbox
                checked={isSelected}
                onChange={(newChecked) => handleTagChange(tag.id, newChecked)}
                className={styles.tagRowCheckbox}
              />
              <div className={styles.tagRowInfo}>
                <span
                  className={styles.tagRowPill}
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.abbreviation}
                </span>
                <span className={styles.tagRowName}>{tag.displayName}</span>
              </div>
            </div>
          );
        })}
      </div>
      {sourceItems.length > 1 && (
        <p className={styles.sourceInfo}>
          Editing {sourceItems.length} combined items
        </p>
      )}
    </Dialog>
  );
};

export default ItemTagDialog;
