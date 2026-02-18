import { useState, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { MealPlanItem } from '../../types';
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    } else if (e.key === 'Escape') {
      setEditText(originalText.current);
      setIsEditing(false);
    }
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
          <input
            className={styles.noteInput}
            value={isEditing ? editText : (item.text || '')}
            readOnly={!isEditing}
            onChange={(e) => isEditing && setEditText(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Write a note..."
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
        <i className="fa-solid fa-xmark" />
      </button>
    </div>
  );
};

export default MealPlanItemRow;
