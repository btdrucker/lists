import { useNavigateWithDebug } from '../../common/hooks';
import styles from './recipe-list-compact.module.css';

interface RecipeListItemCompactProps {
  recipe: any;
  onDelete: (recipeId: string, recipeTitle: string, e: React.MouseEvent) => void;
}

const RecipeListItemCompact = ({ recipe, onDelete }: RecipeListItemCompactProps) => {
  const navigate = useNavigateWithDebug();

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
        <i className="fa-solid fa-trash"></i>
      </button>
      
      {recipe.imageUrl ? (
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className={styles.thumbnail}
        />
      ) : (
        <div className={styles.thumbnailPlaceholder}>
          <i className="fa-solid fa-utensils"></i>
        </div>
      )}
      
      <div className={styles.content}>
        <h3 className={styles.title}>{recipe.title}</h3>
      </div>
    </div>
  );
};

export default RecipeListItemCompact;
