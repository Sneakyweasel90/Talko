import { useEffect } from "react";

interface UseChatKeyboardOptions {
  activeTab: "channels" | "dms";
  textChannelNamesRef: React.MutableRefObject<string[]>;
  currentChannelRef: React.MutableRefObject<string>;
  onOpenSearch: () => void;
  onSelectChannel: (name: string) => void;
}

export function useChatKeyboard({
  activeTab,
  textChannelNamesRef,
  currentChannelRef,
  onOpenSearch,
  onSelectChannel,
}: UseChatKeyboardOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        onOpenSearch();
        return;
      }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (activeTab !== "channels") return;
        const names = textChannelNamesRef.current;
        if (names.length === 0) return;
        e.preventDefault();
        const cur = currentChannelRef.current;
        const idx = names.indexOf(cur);
        const next =
          e.key === "ArrowDown"
            ? names[(idx + 1) % names.length]
            : names[(idx - 1 + names.length) % names.length];
        onSelectChannel(next);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, onOpenSearch, onSelectChannel]);
}