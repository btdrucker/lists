import { useNavigate } from 'react-router-dom';
import styles from './recipe-list.module.css';

interface RecipeListItemProps {
  recipe: any;
  onDelete: (recipeId: string, recipeTitle: string, e: React.MouseEvent) => void;
}

const RecipeListItem = ({ recipe, onDelete }: RecipeListItemProps) => {
  const navigate = useNavigate();
  const category = recipe.category || [];
  const cuisine = recipe.cuisine || [];
  const keywords = recipe.keywords || [];

  return (
    <div
      className={styles.card}
      onClick={() => navigate(`/recipe/${recipe.id}`)}
    >
      <button
        className={styles.deleteButton}
        onClick={(e) => onDelete(recipe.id, recipe.title, e)}
        title="Delete recipe"
      >
        <i className="fa-solid fa-trash-can"></i>
      </button>
      {recipe.imageUrl && (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className={styles.image}
        />
      )}
      <div className={styles.content}>
        <h3 className={styles.title}>{recipe.title}</h3>
        {recipe.description && (
          <p className={styles.description}>{recipe.description}</p>
        )}
        <div className={styles.meta}>
          <span>{recipe.ingredients.length} ingredients</span>
          <span>•</span>
          <span>{recipe.instructions.length} steps</span>
        </div>
        {/* Metadata badges */}
        <div className={styles.badges}>
          {category.map((cat: string, idx: number) => (
            <span key={`cat-${idx}`} className={`${styles.badge} ${styles.badgeCategory}`}>
              {cat}
            </span>
          ))}
          {cuisine.map((cui: string, idx: number) => (
            <span key={`cui-${idx}`} className={`${styles.badge} ${styles.badgeCuisine}`}>
              {cui}
            </span>
          ))}
          {keywords.slice(0, 3).map((keyword: string, idx: number) => (
            <span key={`kw-${idx}`} className={`${styles.badge} ${styles.badgeKeyword}`}>
              {keyword}
            </span>
          ))}
          {keywords.length > 3 && (
            <span className={`${styles.badge} ${styles.badgeKeyword}`}>
              +{keywords.length - 3} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeListItem;
