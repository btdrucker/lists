import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppSelector } from '../../common/hooks';
import Dialog from '../../common/components/Dialog';
import { addTag, updateTag, deleteTag, updateShoppingItem } from '../../firebase/firestore';
import type { Tag, ShoppingItem } from '../../types';
import styles from './editTagsDialog.module.css';

const FAMILY_ID = 'default-family';

const COLOR_PALETTE = [
  '#0066CC',
  '#D32F2F',
  '#388E3C',
  '#FF8C00',
  '#7B1FA2',
  '#00838F',
  '#EC407A',
  '#607D8B',
];

function deriveAbbreviation(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function getDefaultColor(tags: Tag[]): string {
  const usedColors = new Set(tags.map((t) => t.color));
  const firstUnused = COLOR_PALETTE.find((c) => !usedColors.has(c));
  if (firstUnused) return firstUnused;

  const usedCounts = COLOR_PALETTE.reduce<Record<string, number>>((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {});
  tags.forEach((t) => {
    if (usedCounts[t.color] !== undefined) usedCounts[t.color]++;
  });
  return COLOR_PALETTE.reduce((least, c) =>
    usedCounts[c] < usedCounts[least] ? c : least
  );
}

interface EditTagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type DialogMode =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'edit'; tagId: string };

const EditTagsDialog = ({ isOpen, onClose }: EditTagsDialogProps) => {
  const tags: Tag[] = useAppSelector((state) => state.shopping?.tags || []);
  const items: ShoppingItem[] = useAppSelector((state) => state.shopping?.items || []);
  const [mode, setMode] = useState<DialogMode>({ kind: 'list' });
  const [displayName, setDisplayName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);

  const defaultColor = useMemo(() => getDefaultColor(tags), [tags]);
  const isFormMode = mode.kind === 'new' || mode.kind === 'edit';

  // Reset form fields when entering new-tag mode
  useEffect(() => {
    if (mode.kind === 'new') {
      setDisplayName('');
      setAbbreviation('');
      setSelectedColor(defaultColor);
    }
  }, [mode, defaultColor]);

  // Populate form fields when entering edit mode
  useEffect(() => {
    if (mode.kind === 'edit') {
      const tag = tags.find((t) => t.id === mode.tagId);
      if (tag) {
        setDisplayName(tag.displayName);
        setAbbreviation(tag.abbreviation);
        setSelectedColor(tag.color);
      }
    }
  }, [mode, tags]);

  const handleDisplayNameChange = useCallback((value: string) => {
    setDisplayName(value);
    setAbbreviation(deriveAbbreviation(value));
  }, []);

  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => b.sortOrder - a.sortOrder),
    [tags]
  );

  const isFormValid = displayName.trim().length > 0 && abbreviation.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!isFormValid) return;
    try {
      if (mode.kind === 'new') {
        await addTag({
          familyId: FAMILY_ID,
          displayName: displayName.trim(),
          abbreviation: abbreviation.trim().slice(0, 2).toUpperCase(),
          color: selectedColor,
          sortOrder: Date.now(),
        });
      } else if (mode.kind === 'edit') {
        await updateTag(mode.tagId, {
          displayName: displayName.trim(),
          abbreviation: abbreviation.trim().slice(0, 2).toUpperCase(),
          color: selectedColor,
        });
      }
      setMode({ kind: 'list' });
    } catch (error) {
      console.error(`Error ${mode.kind === 'new' ? 'adding' : 'updating'} tag:`, error);
      alert(`Failed to ${mode.kind === 'new' ? 'add' : 'update'} tag`);
    }
  }, [mode, displayName, abbreviation, selectedColor, isFormValid]);

  const handleDeleteTag = useCallback(
    async (tagId: string) => {
      const tag = tags.find((t) => t.id === tagId);
      if (!tag) return;

      const itemsUsingTag = items.filter((item) => item.tagIds.includes(tagId));
      if (itemsUsingTag.length > 0) {
        const confirmed = window.confirm(
          `This tag is used on ${itemsUsingTag.length} item(s). Remove it from all items and delete the tag?`
        );
        if (!confirmed) return;
      }

      try {
        for (const item of itemsUsingTag) {
          await updateShoppingItem(item.id, {
            tagIds: item.tagIds.filter((id) => id !== tagId),
          });
        }
        await deleteTag(tagId);
      } catch (error) {
        console.error('Error deleting tag:', error);
        alert('Failed to delete tag');
      }
    },
    [tags, items]
  );

  const resetForm = useCallback(() => {
    setMode({ kind: 'list' });
    setDisplayName('');
    setAbbreviation('');
  }, []);

  /** X button: if in form mode, go back to list; otherwise close entirely */
  const handleClose = useCallback(() => {
    if (isFormMode) {
      resetForm();
    } else {
      resetForm();
      onClose();
    }
  }, [isFormMode, resetForm, onClose]);

  /** Backdrop click / Escape: always close entirely */
  const handleDismiss = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const dialogTitle = mode.kind === 'new' ? 'New Tag' : mode.kind === 'edit' ? 'Edit Tag' : 'Edit Tags';

  const headerActions = isFormMode ? (
    <button
      type="button"
      className={styles.headerActionButton}
      onClick={handleSave}
      disabled={!isFormValid}
      aria-label="Save"
    >
      <i className="fa-solid fa-check" />
    </button>
  ) : (
    <button
      type="button"
      className={styles.headerActionButton}
      onClick={() => setMode({ kind: 'new' })}
      aria-label="New tag"
    >
      <i className="fa-solid fa-plus" />
    </button>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      onDismiss={handleDismiss}
      title={dialogTitle}
      maxWidth="sm"
      headerActions={headerActions}
    >
      {isFormMode ? (
        <div className={styles.newTagForm}>
          <div className={styles.newTagFormRowInline}>
            <input
              type="text"
              className={styles.newTagInput}
              placeholder="Tag name"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              className={styles.newTagInputAbbr}
              placeholder="Ab"
              maxLength={2}
              value={abbreviation}
              onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
            />
          </div>
          <div className={styles.newTagFormRow}>
            <div className={styles.colorGrid}>
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`${styles.colorSwatch} ${
                    selectedColor === color ? styles.colorSwatchSelected : ''
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Select color ${color}`}
                  aria-pressed={selectedColor === color}
                >
                  {selectedColor === color && (
                    <i className={`fa-solid fa-check ${styles.colorSwatchCheck}`} aria-hidden />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.tagList}>
          {sortedTags.length === 0 && (
            <div className={styles.emptyState}>
              <p>No tags yet</p>
              <p>Tap the + to create one</p>
            </div>
          )}

          {sortedTags.map((tag) => (
            <div
              key={tag.id}
              className={styles.tagRow}
              onClick={() => setMode({ kind: 'edit', tagId: tag.id })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') setMode({ kind: 'edit', tagId: tag.id }); }}
            >
              <div className={styles.tagRowInfo}>
                <span
                  className={styles.tagRowPill}
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.abbreviation}
                </span>
                <span className={styles.tagRowName}>{tag.displayName}</span>
              </div>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id); }}
                aria-label={`Delete ${tag.displayName}`}
              >
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
};

export default EditTagsDialog;
