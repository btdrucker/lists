import { forwardRef } from 'react';
import styles from './inlineEditableTextarea.module.css';

interface InlineEditableTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onCancel?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  ariaLabel?: string;
  /** When true, shows checked/completed style (e.g. line-through, muted) */
  checked?: boolean;
  /** When true, uses italic placeholder style (e.g. for notes) */
  variant?: 'default' | 'note';
  autoFocus?: boolean;
}

const InlineEditableTextarea = forwardRef<HTMLTextAreaElement, InlineEditableTextareaProps>(
  (
    {
      value,
      onChange,
      onBlur,
      onFocus,
      onCancel,
      placeholder = '',
      readOnly = false,
      ariaLabel = 'Item text',
      checked = false,
      variant = 'default',
      autoFocus = false,
    },
    ref
  ) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!readOnly) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          onCancel?.();
        }
      }
    };

    const className = [
      styles.textarea,
      variant === 'note' ? styles.textareaNote : '',
      checked ? styles.textareaChecked : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <textarea
        ref={ref}
        className={className}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
      />
    );
  }
);

InlineEditableTextarea.displayName = 'InlineEditableTextarea';

export default InlineEditableTextarea;
