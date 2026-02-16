import { useNavigateWithDebug } from '../../common/hooks';
import styles from './recipe-list.module.css';

interface RecipeListItemProps {
  recipe: any;
  onAddToCart: (recipe: any, e: React.MouseEvent) => void;
  cartState: 'idle' | 'loading' | 'success';
}

const RecipeListItem = ({ recipe, onAddToCart, cartState }: RecipeListItemProps) => {
  const navigate = useNavigateWithDebug();
  const category = recipe.category || [];
  const cuisine = recipe.cuisine || [];
  const keywords = recipe.keywords || [];

  return (
    <div
      className={styles.card}
      onClick={() => navigate(`/recipe/${recipe.id}`)}
    >
      <button
        className={`${styles.addToCartButton} ${cartState === 'success' ? styles.addToCartSuccess : ''}`}
        onClick={(e) => onAddToCart(recipe, e)}
        title="Add to shopping list"
        disabled={cartState !== 'idle'}
      >
        <i className={
          cartState === 'loading' ? "fa-solid fa-circle-notch fa-spin" :
          cartState === 'success' ? `fa-solid fa-check ${styles.successIcon}` :
          "fa-solid fa-cart-plus"
        }></i>
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
