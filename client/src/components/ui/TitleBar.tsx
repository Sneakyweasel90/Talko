import { APP_VERSION } from "../../version";
import styles from "./TitleBar.module.css";

export default function TitleBar() {
  return (
    <div className={styles.titlebar}>
      <span className={styles.title}>
        TALKO <span className={styles.version}>v{APP_VERSION}</span>
      </span>
      <div className={styles.controls}>
        <button
          className={styles.btn}
          onClick={() => window.electronAPI?.minimize()}
        >
          ─
        </button>
        <button
          className={styles.btn}
          onClick={() => window.electronAPI?.maximize()}
        >
          □
        </button>
        <button
          className={`${styles.btn} ${styles.btnClose}`}
          onClick={() => window.electronAPI?.close()}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
