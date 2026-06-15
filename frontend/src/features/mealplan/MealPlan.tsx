import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
  pointerWithin,
} from '@dnd-kit/core';
import type { DropAnimation } from '@dnd-kit/core';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { mergeMealPlanItemsFromFirestore } from './slice';
import { clearAuth } from '../auth/slice';
import { signOut } from '../../firebase/auth';
import { subscribeToMealPlanItems } from '../../firebase/firestore';
import CircleIconButton from '../../common/components/CircleIconButton';
import DaySection from './DaySection';
import AddRecipeDialog from './AddRecipeDialog';
import MealPlanItemRow from './MealPlanItemRow';
import { useMealPlanActions } from './useMealPlanActions';
import { useMealPlanDnD } from './useMealPlanDnD';
import { formatDateKey, formatDayLabel, buildDateWindow, groupItemsByDate, IDEAS_KEY } from './mealplan-utils';
import styles from './mealplan.module.css';

const FAMILY_ID = 'default-family';
const PAST_DAYS = 3;
const FUTURE_DAYS = 7;

const defaultDropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.4' } },
  }),
};

const MealPlan = () => {
  const dispatch = useAppDispatch();
  const { items, loading } = useAppSelector(
    (state) => state.mealplan || { items: [], loading: true, error: null }
  );

  const [showMenu, setShowMenu] = useState(false);
  const [addingNoteForDate, setAddingNoteForDate] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [recipeDialogDate, setRecipeDialogDate] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToMealPlanItems(FAMILY_ID, (newItems) => {
      dispatch(mergeMealPlanItemsFromFirestore(newItems));
    });
    return () => unsubscribe();
  }, [dispatch]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = formatDateKey(today);
  const dates = useMemo(() => buildDateWindow(today, PAST_DAYS, FUTURE_DAYS), [today]);
  const itemsByDate = useMemo(() => groupItemsByDate(items), [items]);

  const { handleSaveNote, handleAddRecipe, handleDeleteItem, handleNoteSave } =
    useMealPlanActions(itemsByDate);

  const {
    sensors,
    activeItem,
    overDateKey,
    zoneChanged,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useMealPlanDnD();

  const handleSignOut = async () => {
    await signOut();
    dispatch(clearAuth());
  };

  const handleStartAddNote = useCallback((dateKey: string) => {
    setAddingNoteForDate(dateKey);
    setNewNoteText('');
  }, []);

  const handleSaveNoteFromInput = useCallback(() => {
    const text = newNoteText.trim();
    const dateKey = addingNoteForDate;
    if (text && dateKey) {
      handleSaveNote(text, dateKey);
    }
    setAddingNoteForDate(null);
    setNewNoteText('');
  }, [newNoteText, addingNoteForDate, handleSaveNote]);

  const handleCancelNote = useCallback(() => {
    setAddingNoteForDate(null);
    setNewNoteText('');
  }, []);

  if (loading && items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading meal plan...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${styles.pageWithFixedHeader}`}>
      <div className={styles.stickyHeader}>
        <header className={styles.header}>
          <h1>Meal Plan</h1>
          <div className={styles.headerButtons}>
            <div className={styles.menuContainer}>
              <CircleIconButton
                icon="fa-ellipsis-vertical"
                onClick={() => setShowMenu(!showMenu)}
                ariaLabel="Meal plan options"
              />
              {showMenu && (
                <div className={styles.menuDropdown}>
                  <button
                    className={styles.menuItem}
                    onClick={async () => {
                      try {
                        await handleSignOut();
                        setShowMenu(false);
                      } catch (error) {
                        console.error('Error signing out:', error);
                      }
                    }}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.scrollContent}>
          <DaySection
            dateKey={IDEAS_KEY}
            label="Ideas"
            items={itemsByDate.get(IDEAS_KEY) || []}
            isIdeas
            isDropTarget={overDateKey === IDEAS_KEY}
            addingNote={addingNoteForDate === IDEAS_KEY}
            newNoteText={newNoteText}
            onNewNoteTextChange={setNewNoteText}
            onSaveNote={handleSaveNoteFromInput}
            onCancelNote={handleCancelNote}
            onAddNote={() => handleStartAddNote(IDEAS_KEY)}
            onAddRecipe={() => setRecipeDialogDate(IDEAS_KEY)}
            onDeleteItem={handleDeleteItem}
            onNoteSave={handleNoteSave}
          />

          {dates.map((date) => {
            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            const isPast = date < today;
            const dayItems = itemsByDate.get(dateKey) || [];

            if (isPast && dayItems.length === 0) return null;

            return (
              <DaySection
                key={dateKey}
                dateKey={dateKey}
                label={formatDayLabel(date)}
                items={dayItems}
                isToday={isToday}
                isPast={isPast}
                isDropTarget={overDateKey === dateKey}
                addingNote={addingNoteForDate === dateKey}
                newNoteText={newNoteText}
                onNewNoteTextChange={setNewNoteText}
                onSaveNote={handleSaveNoteFromInput}
                onCancelNote={handleCancelNote}
                onAddNote={() => handleStartAddNote(dateKey)}
                onAddRecipe={() => setRecipeDialogDate(dateKey)}
                onDeleteItem={handleDeleteItem}
                onNoteSave={handleNoteSave}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={zoneChanged.current ? null : defaultDropAnimation}>
          {activeItem && (
            <MealPlanItemRow
              item={activeItem}
              isDragOverlay
              onDelete={() => {}}
              onNoteSave={() => {}}
            />
          )}
        </DragOverlay>

        {showMenu && (
          <div
            className={styles.menuBackdrop}
            onClick={() => setShowMenu(false)}
          />
        )}

        {recipeDialogDate !== null && (
          <AddRecipeDialog
            onSelect={(recipe) => {
              handleAddRecipe(recipe, recipeDialogDate);
              setRecipeDialogDate(null);
            }}
            onClose={() => setRecipeDialogDate(null)}
          />
        )}
      </DndContext>
    </div>
  );
};

export default MealPlan;
