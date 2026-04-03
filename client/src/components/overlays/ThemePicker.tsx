import { useState, useRef } from "react";
import { useTheme, themes } from "../../context/ThemeContext";
import styles from "./ThemePicker.module.css";

export default function ThemePicker({ onClose }: { onClose: () => void }) {
  const {
    themeName,
    setTheme,
    customTheme,
    saveCustomTheme,
    chatBg,
    saveChatBg,
    clearChatBg,
    chatBgOpacity,
    saveChatBgOpacity,
  } = useTheme();
  const [editValues, setEditValues] = useState(customTheme);
  const [bgInput, setBgInput] = useState(chatBg);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const handleBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log("File selected:", file.name, file.size);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        console.log("Compressed size:", compressed.length, "Setting bg...");
        setBgInput(compressed);
        saveChatBg(compressed);
        console.log("saveChatBg called");
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const EDITABLE_FIELDS = [
    { key: "primary", label: "Primary" },
    { key: "background", label: "Background" },
    { key: "surface", label: "Surface" },
    { key: "surface2", label: "Surface 2" },
    { key: "text", label: "Text" },
    { key: "error", label: "Error" },
  ] as const;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>THEMES</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.grid}>
          {Object.entries(themes).map(([key, t]) => {
            const isActive = key === themeName;
            return (
              <div
                key={key}
                className={styles.themeCard}
                onClick={() => setTheme(key)}
                style={{
                  border: `1px solid ${isActive ? t.primary : "rgba(255,255,255,0.08)"}`,
                  background: t.background,
                  boxShadow: isActive ? `0 0 12px ${t.primaryGlow}` : "none",
                }}
              >
                <div className={styles.preview}>
                  <div
                    className={styles.previewSidebar}
                    style={{ background: t.surface2 }}
                  />
                  <div
                    className={styles.previewMain}
                    style={{ background: t.background }}
                  >
                    <div
                      className={styles.previewMsg}
                      style={{
                        background: t.primaryGlow,
                        borderColor: t.primary,
                      }}
                    />
                    <div
                      className={styles.previewMsgShort}
                      style={{
                        background: t.primaryGlow,
                        borderColor: t.primary,
                      }}
                    />
                  </div>
                </div>
                <div className={styles.cardFooter}>
                  <span
                    className={styles.cardName}
                    style={{
                      color: isActive ? t.primary : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {isActive ? "▶ " : ""}
                    {t.name}
                  </span>
                  <div
                    className={styles.cardDot}
                    style={{
                      background: t.primary,
                      boxShadow: `0 0 6px ${t.primary}`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom theme editor */}
        {themeName === "custom" && (
          <div className={styles.customEditor}>
            <div className={styles.customTitle}>// CUSTOMISE</div>
            <div className={styles.customFields}>
              {EDITABLE_FIELDS.map(({ key, label }) => (
                <div key={key} className={styles.customField}>
                  <label className={styles.customLabel}>{label}</label>
                  <div className={styles.customInputRow}>
                    <input
                      type="color"
                      value={
                        editValues[key].startsWith("#")
                          ? editValues[key]
                          : "#000000"
                      }
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className={styles.colorPicker}
                    />
                    <input
                      type="text"
                      value={editValues[key]}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className={styles.colorText}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Live preview */}
            <div
              className={styles.livePreview}
              style={{ background: editValues.background }}
            >
              <div
                className={styles.livePreviewSidebar}
                style={{ background: editValues.surface2 }}
              >
                <div
                  className={styles.livePreviewChannel}
                  style={{ color: editValues.primary }}
                >
                  # general
                </div>
                <div
                  className={styles.livePreviewChannel}
                  style={{ color: editValues.text, opacity: 0.5 }}
                >
                  # random
                </div>
              </div>
              <div
                className={styles.livePreviewMain}
                style={{ background: editValues.background }}
              >
                <div className={styles.livePreviewMsg}>
                  <div
                    className={styles.livePreviewAvatar}
                    style={{ background: editValues.primary }}
                  />
                  <div>
                    <div
                      className={styles.livePreviewUsername}
                      style={{ color: editValues.primary }}
                    >
                      User
                    </div>
                    <div
                      className={styles.livePreviewText}
                      style={{ color: editValues.text }}
                    >
                      Hello! This is a preview message.
                    </div>
                  </div>
                </div>
                <div
                  className={styles.livePreviewInput}
                  style={{
                    background: editValues.surface,
                    borderColor: `${editValues.primary}44`,
                  }}
                >
                  <span
                    style={{
                      color: editValues.text,
                      opacity: 0.4,
                      fontSize: "0.7rem",
                    }}
                  >
                    transmit a message...
                  </span>
                </div>
              </div>
            </div>

            <button
              className={styles.saveBtn}
              onClick={() => {
                const p = editValues.primary;
                // parse hex to rgb
                const r = parseInt(p.slice(1, 3), 16);
                const g = parseInt(p.slice(3, 5), 16);
                const b = parseInt(p.slice(5, 7), 16);
                saveCustomTheme({
                  ...editValues,
                  primaryDim: `rgba(${r},${g},${b},0.4)`,
                  primaryGlow: `rgba(${r},${g},${b},0.15)`,
                  border: `rgba(${r},${g},${b},0.2)`,
                  textDim: `rgba(${r},${g},${b},0.5)`,
                  gridColor: `rgba(${r},${g},${b},0.05)`,
                });
              }}
            >
              SAVE THEME
            </button>
          </div>
        )}

        {/* Chat background */}
        <div className={styles.bgEditor}>
          <div className={styles.customTitle}>// CHAT BACKGROUND</div>
          <div className={styles.bgRow}>
            <input
              type="text"
              className={styles.colorText}
              placeholder="Paste image URL..."
              value={bgInput}
              onChange={(e) => setBgInput(e.target.value)}
            />
            <button
              className={styles.bgBtn}
              onClick={() => saveChatBg(bgInput)}
            >
              SET
            </button>
            <button
              className={styles.bgBtn}
              onClick={() => bgFileRef.current?.click()}
            >
              📁
            </button>
            {chatBg && (
              <button
                className={styles.bgBtnDanger}
                onClick={() => {
                  clearChatBg();
                  setBgInput("");
                }}
              >
                ✕
              </button>
            )}
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleBgFile}
            />
          </div>
          <div className={styles.bgOpacityRow}>
            <span className={styles.customLabel}>OPACITY</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={chatBgOpacity}
              onChange={(e) => saveChatBgOpacity(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: "var(--primary)" }}
            />
            <span className={styles.customLabel}>
              {Math.round(chatBgOpacity * 100)}%
            </span>
          </div>
          {chatBg && (
            <div
              className={styles.bgPreview}
              style={{ backgroundImage: `url("${chatBg}")` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
