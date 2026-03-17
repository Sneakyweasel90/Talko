import styles from "./ScreenPickerModal.module.css";

interface Source {
  id: string;
  name: string;
  thumbnailDataURL: string;
}

interface Props {
  sources: Source[];
  onSelect: (id: string) => void;
  onCancel: () => void;
}

export default function ScreenPickerModal({ sources, onSelect, onCancel }: Props) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>Choose what to share</span>
          <button className={styles.closeBtn} onClick={onCancel}>✕</button>
        </div>
        <div className={styles.grid}>
          {sources.map(source => (
            <button
              key={source.id}
              className={styles.tile}
              onClick={() => onSelect(source.id)}
            >
              <img
                src={source.thumbnailDataURL}
                alt={source.name}
                className={styles.thumb}
              />
              <span className={styles.label}>{source.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}