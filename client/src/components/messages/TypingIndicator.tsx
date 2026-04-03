export default function TypingIndicator({ typers, currentUserId }) {
  const names = Object.entries(typers)
    .filter(([id]) => String(id) !== String(currentUserId))
    .map(([, name]) => name);

  if (names.length === 0) return <div style={{ height: "24px" }} />;

  return (
    <div style={styles.indicator}>
      {names.join(", ")} {names.length === 1 ? "is" : "are"} typing...
    </div>
  );
}

const styles = {
  indicator: {
    padding: "0 1.5rem",
    fontSize: "0.8rem",
    color: "#888",
    height: "24px",
  },
};
