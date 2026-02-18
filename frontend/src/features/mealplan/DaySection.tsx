import { useDroppable } from '@dnd-kit/core';
import type { MealPlanItem } from '../../types';
import InlineEditableTextarea from '../../common/components/InlineEditableTextarea';
import MealPlanItemRow from './MealPlanItemRow';
import styles from './mealplan.module.css';

interface DaySectionProps {
  dateKey: string;
  label: string;
  items: MealPlanItem[];
  isToday?: boolean;
  isPast?: boolean;
  isIdeas?: boolean;
  isDropTarget?: boolean;
  addingNote: boolean;
  newNoteText: string;
  onNewNoteTextChange: (text: string) => void;
  onSaveNote: () => void;
  onCancelNote: () => void;
  onAddNote: () => void;
  onAddRecipe: () => void;
  onDeleteItem: (itemId: string) => void;
  onNoteSave: (itemId: string, text: string) => void;
}

const DaySection = ({
  dateKey,
  label,
  items,
  isToday,
  isPast,
  isIdeas,
  isDropTarget,
  addingNote,
  newNoteText,
  onNewNoteTextChange,
  onSaveNote,
  onCancelNote,
  onAddNote,
  onAddRecipe,
  onDeleteItem,
  onNoteSave,
}: DaySectionProps) => {
  const { setNodeRef } = useDroppable({
    id: dateKey,
  });

  const sectionClassName = [
    styles.section,
    isPast ? styles.sectionPast : '',
    isDropTarget ? styles.dropZoneActive : '',
  ].filter(Boolean).join(' ');

  const headerClassName = [
    styles.sectionHeader,
    isToday ? styles.sectionHeaderToday : '',
    isIdeas ? styles.sectionHeaderIdeas : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={setNodeRef}
      className={sectionClassName}
    >
      <div className={headerClassName}>
        <span className={styles.sectionLabel}>
          {isToday && <span className={styles.todayBadge}>Today</span>}
          {label}
        </span>
        <div className={styles.sectionActions}>
          <button
            className={styles.sectionActionButton}
            onClick={onAddNote}
            aria-label="Add note"
            title="Add note"
            type="button"
          >
            <i className="fa-solid fa-pencil" />
          </button>
          <button
            className={styles.sectionActionButton}
            onClick={onAddRecipe}
            aria-label="Add recipe"
            title="Add recipe"
            type="button"
          >
            <i className="fa-solid fa-utensils" />
          </button>
        </div>
      </div>

      <div className={styles.itemList}>
        {addingNote && (
          <div className={styles.newNoteRow}>
            <div className={styles.dragHandle}>
              <i className="fa-solid fa-grip-vertical" />
            </div>
            <InlineEditableTextarea
              value={newNoteText}
              onChange={onNewNoteTextChange}
              onBlur={onSaveNote}
              onCancel={onCancelNote}
              placeholder="Write a note..."
              readOnly={false}
              ariaLabel="New note"
              variant="note"
              autoFocus
            />
          </div>
        )}

        {items.map((item) => (
          <MealPlanItemRow
            key={item.id}
            item={item}
            onDelete={onDeleteItem}
            onNoteSave={onNoteSave}
          />
        ))}

{/* Empty days show only their header — no placeholder text */}
      </div>
    </div>
  );
};

export default DaySection;
