import React from "react";
import styles from "./Avatar.module.css";

function usernameToHue(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

interface Props {
  username: string;
  size?: number;
  avatar?: string | null;
  style?: React.CSSProperties;
}

export default function Avatar({ username, size = 32, avatar, style }: Props) {
  const hue = usernameToHue(username);
  const border = `hsl(${hue}, 70%, 50%)`;

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={username}
        title={username}
        className={styles.avatar}
        style={{
          width: size,
          height: size,
          border: `1px solid ${border}`,
          boxShadow: `0 0 8px ${border}33`,
          ...style,
        }}
      />
    );
  }

  const bg = `hsl(${hue}, 55%, 28%)`;
  const text = `hsl(${hue}, 80%, 75%)`;
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div
      className={styles.initials}
      title={username}
      style={{
        width: size,
        height: size,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: size * 0.34,
        color: text,
        boxShadow: `0 0 8px ${border}33`,
        ...style,
      }}
    >
      {initials}
    </div>
  );
}
