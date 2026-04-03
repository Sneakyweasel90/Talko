import { useLinkPreview } from "../../hooks/useLinkPreview";
import styles from "./LinkPreview.module.css";

interface Props {
  url: string;
}

export default function LinkPreview({ url }: Props) {
  const { preview, loading } = useLinkPreview(url);

  if (loading || !preview) return null;
  if (!preview.title && !preview.image) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <img src={preview.image} alt="" className={styles.image} />
      )}
      <div className={styles.text}>
        {preview.siteName && (
          <div className={styles.siteName}>{preview.siteName}</div>
        )}
        {preview.title && <div className={styles.title}>{preview.title}</div>}
        {preview.description && (
          <div className={styles.description}>{preview.description}</div>
        )}
      </div>
    </a>
  );
}
