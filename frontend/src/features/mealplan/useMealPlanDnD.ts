import { useState, useRef, useCallback } from 'react';
import { useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { updateMealPlanItem } from '../../firebase/firestore';
import type { MealPlanItem } from '../../types';
import { IDEAS_KEY } from './mealplan-utils';

export function useMealPlanDnD() {
  const [activeItem, setActiveItem] = useState<MealPlanItem | null>(null);
  const [overDateKey, setOverDateKey] = useState<string | null>(null);
  const zoneChanged = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

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

  return {
    sensors,
    activeItem,
    overDateKey,
    zoneChanged,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
