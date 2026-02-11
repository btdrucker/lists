import type { Tag } from '../../types';
import styles from './tagDialog.module.css';

interface TagDialogProps {
  tags: Tag[];
  selectedTagIds: string[];
  itemIds: string[];
  onTagToggle: (itemIds: string[], tagId: string) => void;
  showAbove?: boolean;
  isPositioned?: boolean;
}

const TagDialog = ({
  tags,
  selectedTagIds,
  itemIds,
  onTagToggle,
  showAbove = false,
  isPositioned = true,
}: TagDialogProps) => {
  return (
    <div 
      className={`${styles.tagDialog} ${showAbove ? styles.tagDialogAbove : ''} ${!isPositioned ? styles.tagDialogHidden : ''}`} 
      onClick={(e) => e.stopPropagation()}
    >
      {[...tags]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              className={`${styles.tagDialogOption} ${
                isSelected ? styles.tagDialogOptionSelected : ''
              }`}
              style={{
                backgroundColor: tag.color,
              }}
              onClick={() => onTagToggle(itemIds, tag.id)}
            >
              {tag.displayName}
            </button>
          );
        })}
    </div>
  );
};

export default TagDialog;
