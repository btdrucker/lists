import styles from './recipe.module.css';

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

const TagInput = ({ label, tags, onChange, placeholder }: TagInputProps) => (
  <div className={styles.section}>
    <h3>{label}</h3>
    <div className={styles.tagsList}>
      {tags.map((tag) => (
        <div key={tag} className={styles.tag}>
          <span>{tag}</span>
          <button
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            className={styles.tagRemove}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
    <div className={styles.tagInput}>
      <input
        type="text"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const value = e.currentTarget.value.trim();
            if (value && !tags.includes(value)) {
              onChange([...tags, value]);
              e.currentTarget.value = '';
            }
          }
        }}
        onBlur={(e) => {
          const value = e.currentTarget.value.trim();
          if (value && !tags.includes(value)) {
            onChange([...tags, value]);
            e.currentTarget.value = '';
          }
        }}
      />
    </div>
  </div>
);

export default TagInput;
