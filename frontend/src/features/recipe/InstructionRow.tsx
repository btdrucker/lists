import { useAutoHeight } from '../../common/hooks';
import styles from './recipe.module.css';

interface InstructionRowProps {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  registerRef?: (element: HTMLTextAreaElement | null) => void;
}

const InstructionRow = ({
  index,
  value,
  onChange,
  onRemove,
  onKeyDown,
  registerRef,
}: InstructionRowProps) => {
  const textareaRef = useAutoHeight<HTMLTextAreaElement>(value);
  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
    if (registerRef) registerRef(element);
  };

  return (
    <div className={styles.instructionRow}>
      <span className={styles.stepNumber}>{index + 1}.</span>
      <textarea
        ref={setTextareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Describe this step"
        className={styles.instructionInput}
      />
      <button onClick={onRemove} className={styles.removeButton}>
        ×
      </button>
    </div>
  );
};

export default InstructionRow;
