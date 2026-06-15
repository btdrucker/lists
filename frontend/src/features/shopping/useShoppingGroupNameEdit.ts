import { useState, useEffect, useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { addShoppingGroup, updateShoppingGroup } from '../../firebase/firestore';
import { useAppDispatch } from '../../common/hooks';
import { setViewMode } from './slice';

const FAMILY_ID = 'default-family';

export interface UseShoppingGroupNameEditReturn {
  editingGroupId: string | null;
  editingGroupName: string;
  setEditingGroupName: (name: string) => void;
  editingInputRef: RefObject<HTMLTextAreaElement | null>;
  handleAddGroup: () => Promise<void>;
  handleStartEditGroupName: (groupId: string, currentName: string) => void;
  handleSaveGroupName: () => Promise<void>;
  handleCancelEditGroupName: () => void;
}

export function useShoppingGroupNameEdit(): UseShoppingGroupNameEditReturn {
  const dispatch = useAppDispatch();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const editingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isCancelingRef = useRef(false);

  useEffect(() => {
    if (editingGroupId && editingInputRef.current) {
      editingInputRef.current.focus();
      editingInputRef.current.select();
    }
  }, [editingGroupId]);

  const handleAddGroup = useCallback(async () => {
    try {
      const newGroup = await addShoppingGroup({
        familyId: FAMILY_ID,
        displayName: 'New Group',
        sortOrder: Date.now(),
      });
      dispatch(setViewMode('recipe-grouped'));
      setEditingGroupId(newGroup.id);
      setEditingGroupName(newGroup.displayName);
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    }
  }, [dispatch]);

  const handleStartEditGroupName = useCallback((groupId: string, currentName: string) => {
    setEditingGroupId(groupId);
    setEditingGroupName(currentName);
  }, []);

  const handleSaveGroupName = useCallback(async () => {
    if (isCancelingRef.current) {
      isCancelingRef.current = false;
      return;
    }
    if (!editingGroupId) return;

    const trimmedName = editingGroupName.trim();
    if (!trimmedName) {
      setEditingGroupId(null);
      setEditingGroupName('');
      return;
    }

    try {
      await updateShoppingGroup(editingGroupId, { displayName: trimmedName });
    } catch (error) {
      console.error('Error updating group name:', error);
    }

    setEditingGroupId(null);
    setEditingGroupName('');
  }, [editingGroupId, editingGroupName]);

  const handleCancelEditGroupName = useCallback(() => {
    isCancelingRef.current = true;
    setEditingGroupId(null);
    setEditingGroupName('');
    if (editingInputRef.current) editingInputRef.current.blur();
  }, []);

  return {
    editingGroupId,
    editingGroupName,
    setEditingGroupName,
    editingInputRef,
    handleAddGroup,
    handleStartEditGroupName,
    handleSaveGroupName,
    handleCancelEditGroupName,
  };
}
