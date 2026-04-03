import { useState, useRef, useCallback } from "react";
import styles from "./ResizableSidebar.module.css";

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 230;

interface Props {
  children: React.ReactNode;
}

export default function ResizableSidebar({ children }: Props) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startX.current = e.clientX;
      startWidth.current = width;
      setDragging(true);

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX.current;
        const newWidth = Math.min(
          MAX_WIDTH,
          Math.max(MIN_WIDTH, startWidth.current + delta),
        );
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width],
  );

  return (
    <div className={styles.root} style={{ width: `${width}px` }}>
      <div className={styles.content}>{children}</div>
      <div
        className={`${styles.handle} ${dragging ? styles.dragging : ""}`}
        onMouseDown={onMouseDown}
      />
    </div>
  );
}
