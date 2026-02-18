import { useState, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { MealPlanItem } from '../../types';
import InlineEditableTextarea from '../../common/components/InlineEditableTextarea';
import styles from './mealplan.module.css';

interface MealPlanItemRowProps {
  item: MealPlanItem;
  isDragOverlay?: boolean;
  onDelete: (itemId: string) => void;
  onNoteSave: (itemId: string, text: string) => void;
}

const MealPlanItemRow = ({ item, isDragOverlay, onDelete, onNoteSave }: MealPlanItemRowProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
    disabled: isDragOverlay,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const originalText = useRef('');

  const handleFocus = () => {
    if (!isEditing) {
      const text = item.text || '';
      setEditText(text);
      originalText.current = text;
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      const trimmed = editText.trim();
      if (trimmed !== originalText.current) {
        onNoteSave(item.id, trimmed);
      }
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditText(originalText.current);
    setIsEditing(false);
  };

  const rowClassName = [
    styles.itemRow,
    isDragging ? styles.itemRowDragging : '',
    isDragOverlay ? styles.itemRowOverlay : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={setNodeRef} className={rowClassName}>
      <div className={styles.dragHandle} {...listeners} {...attributes}>
        <i className="fa-solid fa-grip-vertical" />
      </div>

      <div className={styles.itemContent}>
        {item.type === 'recipe' ? (
          <>
            <i className={`fa-solid fa-utensils ${styles.itemIcon}`} />
            <span className={styles.itemText}>{item.recipeTitle}</span>
          </>
        ) : (
          <InlineEditableTextarea
            value={isEditing ? editText : (item.text || '')}
            onChange={(v) => isEditing && setEditText(v)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onCancel={handleCancel}
            placeholder="Write a note..."
            readOnly={!isEditing}
            ariaLabel="Note"
            variant="note"
          />
        )}
      </div>

      <button
        className={styles.deleteButton}
        onClick={() => onDelete(item.id)}
        aria-label="Remove item"
        title="Remove item"
        type="button"
      >
        <i className="fa-solid fa-trash" />
      </button>
    </div>
  );
};

export default MealPlanItemRow;
