import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent, DropAnimation } from '@dnd-kit/core';
import { useAppSelector, useAppDispatch } from '../../common/hooks';
import { setMealPlanItems } from './slice';
import { clearAuth } from '../auth/slice';
import { signOut } from '../../firebase/auth';
import {
  subscribeToMealPlanItems,
  addMealPlanItem,
  updateMealPlanItem,
  deleteMealPlanItem,
} from '../../firebase/firestore';
import type { MealPlanItem, Recipe } from '../../types';
import CircleIconButton from '../../common/components/CircleIconButton';
import DaySection from './DaySection';
import AddRecipeDialog from './AddRecipeDialog';
import MealPlanItemRow from './MealPlanItemRow';
import styles from './mealplan.module.css';

const FAMILY_ID = 'default-family';

const defaultDropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.4' } },
  }),
};
const PAST_DAYS = 3;
const FUTURE_DAYS = 7;
const IDEAS_KEY = 'ideas';

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayLabel(date: Date, today: Date): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
}

function buildDateWindow(today: Date): Date[] {
  const dates: Date[] = [];
  for (let i = -PAST_DAYS; i <= FUTURE_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function groupItemsByDate(items: MealPlanItem[]): Map<string, MealPlanItem[]> {
  const map = new Map<string, MealPlanItem[]>();
  for (const item of items) {
    const key = item.date ?? IDEAS_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  // Sort items within each group by sortOrder ascending
  for (const [, groupItems] of map) {
    groupItems.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
}

const MealPlan = () => {
  const dispatch = useAppDispatch();
  const { items, loading } = useAppSelector(
    (state) => state.mealplan || { items: [], loading: true, error: null }
  );

  const [showMenu, setShowMenu] = useState(false);
  const [addingNoteForDate, setAddingNoteForDate] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [recipeDialogDate, setRecipeDialogDate] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<MealPlanItem | null>(null);
  const [overDateKey, setOverDateKey] = useState<string | null>(null);
  const zoneChanged = useRef(false);

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToMealPlanItems(FAMILY_ID, (newItems) => {
      dispatch(setMealPlanItems(newItems));
    });
    return () => unsubscribe();
  }, [dispatch]);

  // Compute dates
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = formatDateKey(today);
  const dates = useMemo(() => buildDateWindow(today), [today]);

  // Group items by date
  const itemsByDate = useMemo(() => groupItemsByDate(items), [items]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleSignOut = async () => {
    await signOut();
    dispatch(clearAuth());
  };

  // Add note
  const handleStartAddNote = useCallback((dateKey: string) => {
    setAddingNoteForDate(dateKey);
    setNewNoteText('');
  }, []);

  const handleSaveNote = useCallback(async () => {
    const text = newNoteText.trim();
    if (!text || !addingNoteForDate) {
      setAddingNoteForDate(null);
      setNewNoteText('');
      return;
    }

    try {
      await addMealPlanItem({
        familyId: FAMILY_ID,
        type: 'note',
        text,
        date: addingNoteForDate === IDEAS_KEY ? null : addingNoteForDate,
        sortOrder: Date.now(),
      });
    } catch (error) {
      console.error('Error adding note:', error);
    }

    setAddingNoteForDate(null);
    setNewNoteText('');
  }, [newNoteText, addingNoteForDate]);

  const handleCancelNote = useCallback(() => {
    setAddingNoteForDate(null);
    setNewNoteText('');
  }, []);

  // Add recipe
  const handleAddRecipe = useCallback(async (recipe: Recipe, dateKey: string) => {
    try {
      await addMealPlanItem({
        familyId: FAMILY_ID,
        type: 'recipe',
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        date: dateKey === IDEAS_KEY ? null : dateKey,
        sortOrder: Date.now(),
      });
    } catch (error) {
      console.error('Error adding recipe:', error);
    }
    setRecipeDialogDate(null);
  }, []);

  // Delete item
  const handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      await deleteMealPlanItem(itemId);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }, []);

  // Save note text (called once on blur, not on every keystroke)
  const handleNoteSave = useCallback(async (itemId: string, text: string) => {
    try {
      await updateMealPlanItem(itemId, { text });
    } catch (error) {
      console.error('Error updating note:', error);
    }
  }, []);

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = event.active.data.current?.item as MealPlanItem | undefined;
    if (item) setActiveItem(item);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverDateKey(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    setOverDateKey(null);

    const draggedItem = active.data.current?.item as MealPlanItem | undefined;
    if (!over || !draggedItem) {
      zoneChanged.current = false;
      setActiveItem(null);
      return;
    }

    const targetDateKey = over.id as string;
    const currentDateKey = draggedItem.date ?? IDEAS_KEY;

    // Only update if dropped on a different day
    if (targetDateKey === currentDateKey) {
      zoneChanged.current = false;
      setActiveItem(null);
      return;
    }

    zoneChanged.current = true;
    setActiveItem(null);

    const newDate = targetDateKey === IDEAS_KEY ? null : targetDateKey;
    try {
      await updateMealPlanItem(draggedItem.id, {
        date: newDate,
        sortOrder: Date.now(),
      });
    } catch (error) {
      console.error('Error moving item:', error);
    }
  }, []);

  if (loading && items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading meal plan...</div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.container}>
        <div className={styles.stickyHeader}>
          <header className={styles.header}>
            <h1>Meal Plan</h1>
            <div className={styles.headerButtons}>
              {/* Mobile: Menu */}
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

        {/* Ideas section */}
        <DaySection
          dateKey={IDEAS_KEY}
          label="Ideas"
          items={itemsByDate.get(IDEAS_KEY) || []}
          isIdeas
          isDropTarget={overDateKey === IDEAS_KEY}
          addingNote={addingNoteForDate === IDEAS_KEY}
          newNoteText={newNoteText}
          onNewNoteTextChange={setNewNoteText}
          onSaveNote={handleSaveNote}
          onCancelNote={handleCancelNote}
          onAddNote={() => handleStartAddNote(IDEAS_KEY)}
          onAddRecipe={() => setRecipeDialogDate(IDEAS_KEY)}
          onDeleteItem={handleDeleteItem}
          onNoteSave={handleNoteSave}
        />

        {/* Day sections */}
        {dates.map((date) => {
          const dateKey = formatDateKey(date);
          const isToday = dateKey === todayKey;
          const isPast = date < today;
          const dayItems = itemsByDate.get(dateKey) || [];

          // Hide empty past days
          if (isPast && dayItems.length === 0) return null;

          return (
            <DaySection
              key={dateKey}
              dateKey={dateKey}
              label={formatDayLabel(date, today)}
              items={dayItems}
              isToday={isToday}
              isPast={isPast}
              isDropTarget={overDateKey === dateKey}
              addingNote={addingNoteForDate === dateKey}
              newNoteText={newNoteText}
              onNewNoteTextChange={setNewNoteText}
              onSaveNote={handleSaveNote}
              onCancelNote={handleCancelNote}
              onAddNote={() => handleStartAddNote(dateKey)}
              onAddRecipe={() => setRecipeDialogDate(dateKey)}
              onDeleteItem={handleDeleteItem}
              onNoteSave={handleNoteSave}
            />
          );
        })}
      </div>

      {/* Drag overlay */}
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

      {/* Mobile menu backdrop */}
      {showMenu && (
        <div
          className={styles.menuBackdrop}
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Recipe picker dialog */}
      {recipeDialogDate !== null && (
        <AddRecipeDialog
          onSelect={(recipe) => handleAddRecipe(recipe, recipeDialogDate)}
          onClose={() => setRecipeDialogDate(null)}
        />
      )}
    </DndContext>
  );
};

export default MealPlan;
