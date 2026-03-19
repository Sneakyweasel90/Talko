import { createContext, useContext, useState, useEffect } from "react";
import { saveBgToDB, loadBgFromDB, clearBgFromDB } from "../utils/bgStorage";

export const themes = {
  cyberpunk: {
    name: "Cyberpunk",
    primary: "#00ff9f",
    primaryDim: "rgba(0,255,159,0.4)",
    primaryGlow: "rgba(0,255,159,0.15)",
    background: "#020a06",
    surface: "#010a05",
    surface2: "#020d07",
    border: "rgba(0,255,159,0.15)",
    text: "rgba(200,255,220,0.9)",
    textDim: "rgba(0,255,159,0.5)",
    error: "#ff3366",
    gridColor: "rgba(0,255,159,0.05)",
  },
  discord: {
    name: "Discord",
    primary: "#5865f2",
    primaryDim: "rgba(88,101,242,0.4)",
    primaryGlow: "rgba(88,101,242,0.15)",
    background: "#313338",
    surface: "#2b2d31",
    surface2: "#1e1f22",
    border: "rgba(88,101,242,0.2)",
    text: "#dcddde",
    textDim: "rgba(148,155,164,0.8)",
    error: "#ed4245",
    gridColor: "rgba(88,101,242,0.03)",
  },
  midnight: {
    name: "Midnight",
    primary: "#748ffc",
    primaryDim: "rgba(116,143,252,0.4)",
    primaryGlow: "rgba(116,143,252,0.15)",
    background: "#0a0e1a",
    surface: "#0d1117",
    surface2: "#080b14",
    border: "rgba(116,143,252,0.15)",
    text: "rgba(200,210,255,0.9)",
    textDim: "rgba(116,143,252,0.5)",
    error: "#ff6b6b",
    gridColor: "rgba(116,143,252,0.04)",
  },
  blood: {
    name: "Blood",
    primary: "#ff3366",
    primaryDim: "rgba(255,51,102,0.4)",
    primaryGlow: "rgba(255,51,102,0.15)",
    background: "#0a0205",
    surface: "#0d0308",
    surface2: "#12030a",
    border: "rgba(255,51,102,0.15)",
    text: "rgba(255,200,210,0.9)",
    textDim: "rgba(255,51,102,0.5)",
    error: "#ff9f43",
    gridColor: "rgba(255,51,102,0.04)",
  },
  arctic: {
    name: "Arctic",
    primary: "#00d2ff",
    primaryDim: "rgba(0,210,255,0.4)",
    primaryGlow: "rgba(0,210,255,0.15)",
    background: "#020d12",
    surface: "#03111a",
    surface2: "#021018",
    border: "rgba(0,210,255,0.15)",
    text: "rgba(200,240,255,0.9)",
    textDim: "rgba(0,210,255,0.5)",
    error: "#ff6b6b",
    gridColor: "rgba(0,210,255,0.04)",
  },
  synthwave: {
    name: "Synthwave",
    primary: "#f72585",
    primaryDim: "rgba(247,37,133,0.4)",
    primaryGlow: "rgba(247,37,133,0.15)",
    background: "#0d0015",
    surface: "#120020",
    surface2: "#0a0010",
    border: "rgba(247,37,133,0.2)",
    text: "rgba(255,200,240,0.9)",
    textDim: "rgba(180,100,255,0.7)",
    error: "#4cc9f0",
    gridColor: "rgba(247,37,133,0.04)",
  },
  matrix: {
    name: "Matrix",
    primary: "#00ff00",
    primaryDim: "rgba(0,255,0,0.4)",
    primaryGlow: "rgba(0,255,0,0.15)",
    background: "#000300",
    surface: "#001000",
    surface2: "#000800",
    border: "rgba(0,255,0,0.15)",
    text: "rgba(180,255,180,0.9)",
    textDim: "rgba(0,255,0,0.5)",
    error: "#ff3366",
    gridColor: "rgba(0,255,0,0.05)",
  },
  sunset: {
    name: "Sunset",
    primary: "#ff9f43",
    primaryDim: "rgba(255,159,67,0.4)",
    primaryGlow: "rgba(255,159,67,0.15)",
    background: "#0d0800",
    surface: "#120b00",
    surface2: "#0a0600",
    border: "rgba(255,159,67,0.15)",
    text: "rgba(255,235,200,0.9)",
    textDim: "rgba(255,159,67,0.5)",
    error: "#ff3366",
    gridColor: "rgba(255,159,67,0.04)",
  },
  ocean: {
    name: "Ocean",
    primary: "#00b4d8",
    primaryDim: "rgba(0,180,216,0.4)",
    primaryGlow: "rgba(0,180,216,0.15)",
    background: "#020b0f",
    surface: "#030f15",
    surface2: "#021018",
    border: "rgba(0,180,216,0.15)",
    text: "rgba(180,235,255,0.9)",
    textDim: "rgba(0,180,216,0.5)",
    error: "#ff6b6b",
    gridColor: "rgba(0,180,216,0.04)",
  },
  ghost: {
    name: "Ghost",
    primary: "#e0e0e0",
    primaryDim: "rgba(224,224,224,0.4)",
    primaryGlow: "rgba(224,224,224,0.1)",
    background: "#0a0a0a",
    surface: "#111111",
    surface2: "#0d0d0d",
    border: "rgba(224,224,224,0.1)",
    text: "rgba(220,220,220,0.9)",
    textDim: "rgba(160,160,160,0.6)",
    error: "#ff3366",
    gridColor: "rgba(224,224,224,0.02)",
  },
  lava: {
    name: "Lava",
    primary: "#ff6b35",
    primaryDim: "rgba(255,107,53,0.4)",
    primaryGlow: "rgba(255,107,53,0.12)",
    background: "#0d0500",
    surface: "#120800",
    surface2: "#0a0400",
    border: "rgba(255,107,53,0.15)",
    text: "rgba(255,220,200,0.9)",
    textDim: "rgba(255,107,53,0.5)",
    error: "#ff3366",
    gridColor: "rgba(255,107,53,0.04)",
  },
  toxic: {
    name: "Toxic",
    primary: "#a8ff00",
    primaryDim: "rgba(168,255,0,0.4)",
    primaryGlow: "rgba(168,255,0,0.12)",
    background: "#050a00",
    surface: "#080d00",
    surface2: "#040800",
    border: "rgba(168,255,0,0.15)",
    text: "rgba(220,255,180,0.9)",
    textDim: "rgba(168,255,0,0.5)",
    error: "#ff3366",
    gridColor: "rgba(168,255,0,0.04)",
  },
  rose: {
    name: "Rose",
    primary: "#ff6eb4",
    primaryDim: "rgba(255,110,180,0.4)",
    primaryGlow: "rgba(255,110,180,0.12)",
    background: "#0d0008",
    surface: "#12000d",
    surface2: "#0a0007",
    border: "rgba(255,110,180,0.15)",
    text: "rgba(255,210,235,0.9)",
    textDim: "rgba(255,110,180,0.5)",
    error: "#ff9f43",
    gridColor: "rgba(255,110,180,0.04)",
  },
  gold: {
    name: "Gold",
    primary: "#ffd700",
    primaryDim: "rgba(255,215,0,0.4)",
    primaryGlow: "rgba(255,215,0,0.12)",
    background: "#0a0800",
    surface: "#0f0c00",
    surface2: "#080600",
    border: "rgba(255,215,0,0.15)",
    text: "rgba(255,245,200,0.9)",
    textDim: "rgba(255,215,0,0.5)",
    error: "#ff3366",
    gridColor: "rgba(255,215,0,0.04)",
  },
  void: {
    name: "Void",
    primary: "#9d4edd",
    primaryDim: "rgba(157,78,221,0.4)",
    primaryGlow: "rgba(157,78,221,0.12)",
    background: "#05000d",
    surface: "#080012",
    surface2: "#04000a",
    border: "rgba(157,78,221,0.15)",
    text: "rgba(220,200,255,0.9)",
    textDim: "rgba(157,78,221,0.5)",
    error: "#ff3366",
    gridColor: "rgba(157,78,221,0.04)",
  },
  ice: {
    name: "Ice",
    primary: "#a8d8ea",
    primaryDim: "rgba(168,216,234,0.4)",
    primaryGlow: "rgba(168,216,234,0.12)",
    background: "#00080f",
    surface: "#000d17",
    surface2: "#00060c",
    border: "rgba(168,216,234,0.15)",
    text: "rgba(210,240,255,0.9)",
    textDim: "rgba(168,216,234,0.5)",
    error: "#ff6b6b",
    gridColor: "rgba(168,216,234,0.04)",
  },
  ember: {
    name: "Ember",
    primary: "#ff4500",
    primaryDim: "rgba(255,69,0,0.4)",
    primaryGlow: "rgba(255,69,0,0.12)",
    background: "#0d0200",
    surface: "#120300",
    surface2: "#0a0100",
    border: "rgba(255,69,0,0.15)",
    text: "rgba(255,210,190,0.9)",
    textDim: "rgba(255,69,0,0.5)",
    error: "#ffd700",
    gridColor: "rgba(255,69,0,0.04)",
  },
  steel: {
    name: "Steel",
    primary: "#8892a4",
    primaryDim: "rgba(136,146,164,0.4)",
    primaryGlow: "rgba(136,146,164,0.12)",
    background: "#080a0d",
    surface: "#0c0e12",
    surface2: "#06080a",
    border: "rgba(136,146,164,0.15)",
    text: "rgba(200,210,220,0.9)",
    textDim: "rgba(136,146,164,0.5)",
    error: "#ff6b6b",
    gridColor: "rgba(136,146,164,0.04)",
  },
  sakura: {
    name: "Sakura",
    primary: "#ffb7c5",
    primaryDim: "rgba(255,183,197,0.4)",
    primaryGlow: "rgba(255,183,197,0.12)",
    background: "#0d0508",
    surface: "#12070b",
    surface2: "#0a0406",
    border: "rgba(255,183,197,0.15)",
    text: "rgba(255,225,230,0.9)",
    textDim: "rgba(255,183,197,0.5)",
    error: "#ff6b6b",
    gridColor: "rgba(255,183,197,0.04)",
  },
  neon: {
    name: "Neon",
    primary: "#ff00ff",
    primaryDim: "rgba(255,0,255,0.4)",
    primaryGlow: "rgba(255,0,255,0.12)",
    background: "#08000d",
    surface: "#0d0012",
    surface2: "#06000a",
    border: "rgba(255,0,255,0.15)",
    text: "rgba(255,200,255,0.9)",
    textDim: "rgba(255,0,255,0.5)",
    error: "#00ff9f",
    gridColor: "rgba(255,0,255,0.04)",
  },
  custom: {
    name: "Custom",
    primary: "#00ff9f",
    primaryDim: "rgba(0,255,159,0.4)",
    primaryGlow: "rgba(0,255,159,0.15)",
    background: "#020a06",
    surface: "#010a05",
    surface2: "#020d07",
    border: "rgba(0,255,159,0.15)",
    text: "rgba(200,255,220,0.9)",
    textDim: "rgba(0,255,159,0.5)",
    error: "#ff3366",
    gridColor: "rgba(0,255,159,0.05)",
  },
};

const ThemeContext = createContext<any>(null);

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(
    () => localStorage.getItem("talko_theme") || "cyberpunk",
  );
  const [customTheme, setCustomThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem("talko_custom_theme");
      return saved ? JSON.parse(saved) : themes.custom;
    } catch {
      return themes.custom;
    }
  });

  const [chatBgOpacity, setChatBgOpacity] = useState(() =>
    parseFloat(localStorage.getItem("talko_chat_bg_opacity") || "0.4"),
  );

  const theme = themeName === "custom" ? customTheme : themes[themeName];

  const saveCustomTheme = (values: typeof themes.custom) => {
    localStorage.setItem("talko_custom_theme", JSON.stringify(values));
    setCustomThemeState(values);
  };

  const [chatBg, setChatBgState] = useState("");

  const saveChatBg = async (url: string) => {
    if ((window as any).electronAPI?.saveBg) {
      await (window as any).electronAPI.saveBg(url).catch(() => {});
    } else {
      saveBgToDB(url).catch(() => {});
    }
    setChatBgState(url);
  };

  const saveChatBgOpacity = (opacity: number) => {
    localStorage.setItem("talko_chat_bg_opacity", String(opacity));
    setChatBgOpacity(opacity);
    document.documentElement.style.setProperty(
      "--chat-bg-opacity",
      String(opacity),
    );
  };

  const clearChatBg = async () => {
    if ((window as any).electronAPI?.clearBg) {
      await (window as any).electronAPI.clearBg().catch(() => {});
    } else {
      clearBgFromDB().catch(() => {});
    }
    setChatBgState("");
  };

  useEffect(() => {
    const load = async () => {
      let bg = "";
      if ((window as any).electronAPI?.loadBg) {
        bg = await (window as any).electronAPI.loadBg().catch(() => "");
      } else {
        bg = await loadBgFromDB().catch(() => "");
      }
      setChatBgState(bg);
      document.documentElement.style.setProperty(
        "--chat-bg",
        bg ? `url("${bg}")` : "none"
      );
    };
    load();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--chat-bg-opacity",
      String(chatBgOpacity),
    );
  }, [chatBgOpacity]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--chat-bg",
      chatBg ? `url("${chatBg}")` : "none",
    );
  }, [chatBg]);

  // Inject theme values as CSS custom properties on :root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--primary-dim", theme.primaryDim);
    root.style.setProperty("--primary-glow", theme.primaryGlow);
    root.style.setProperty("--background", theme.background);
    root.style.setProperty("--surface", theme.surface);
    root.style.setProperty("--surface2", theme.surface2);
    root.style.setProperty("--border", theme.border);
    root.style.setProperty("--text", theme.text);
    root.style.setProperty("--text-dim", theme.textDim);
    root.style.setProperty("--error", theme.error);
    root.style.setProperty("--grid-color", theme.gridColor);
  }, [theme]);

  const setTheme = (name) => {
    localStorage.setItem("talko_theme", name);
    setThemeName(name);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeName,
        setTheme,
        themes,
        customTheme,
        saveCustomTheme,
        chatBg,
        saveChatBg,
        clearChatBg,
        chatBgOpacity,
        saveChatBgOpacity, 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
