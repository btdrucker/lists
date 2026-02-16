import { useNavigateWithDebug } from '../../common/hooks';
import styles from './recipe-list-compact.module.css';

interface RecipeListItemCompactProps {
  recipe: any;
  onAddToCart: (recipe: any, e: React.MouseEvent) => void;
  cartState: 'idle' | 'loading' | 'success';
}

const RecipeListItemCompact = ({ recipe, onAddToCart, cartState }: RecipeListItemCompactProps) => {
  const navigate = useNavigateWithDebug();

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
