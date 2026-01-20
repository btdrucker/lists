import styles from './placeholderPage.module.css';

interface PlaceholderPageProps {
  title: string;
  message: string;
}

const PlaceholderPage = ({ title, message }: PlaceholderPageProps) => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
    </div>
  );
};

export default PlaceholderPage;
