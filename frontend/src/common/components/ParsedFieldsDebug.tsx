import styles from './parsedFieldsDebug.module.css';

interface ParsedFieldsDebugProps {
  amount: number | null;
  unit: string | null;
  name: string;
}

/**
 * Renders parsed amount | unit | name as small gray debug text.
 * Only render when at least one field has a value.
 */
const ParsedFieldsDebug = ({ amount, unit, name }: ParsedFieldsDebugProps) => {
  const amountStr = amount != null ? String(amount) : '-';
  const unitStr = unit || '-';
  const nameStr = name.trim() || '-';

  return (
    <div className={styles.debug}>
      Parsed: {amountStr} | {unitStr} | {nameStr}
    </div>
  );
};

export default ParsedFieldsDebug;
