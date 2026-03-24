import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./GifPicker.module.css";

interface KlipyGif {
  id: string;
  url: string;
  preview: string;
  title: string;
}

interface Props {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const KLIPY_KEY = import.meta.env.VITE_KLIPY_API_KEY as string;
const LIMIT = 24;

async function fetchKlipy(query: string): Promise<KlipyGif[]> {
  if (!KLIPY_KEY) {
    console.warn("Talko: VITE_KLIPY_API_KEY is not set.");
    return [];
  }

  // Klipy uses the same endpoint structure as Tenor v2 — just a different base URL
  const endpoint = query.trim()
    ? `https://api.klipy.com/v2/search?q=${encodeURIComponent(query)}&key=${KLIPY_KEY}&limit=${LIMIT}&media_filter=gif`
    : `https://api.klipy.com/v2/featured?key=${KLIPY_KEY}&limit=${LIMIT}&media_filter=gif`;

  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const data = await res.json();

  return (data.results ?? []).map((r: any) => ({
    id: r.id,
    url: r.media_formats?.gif?.url ?? "",
    preview: r.media_formats?.tinygif?.url ?? r.media_formats?.gif?.url ?? "",
    title: r.title ?? "",
  }));
}

export default function GifPicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(false);
    try {
      const results = await fetchKlipy(q);
      setGifs(results);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => {
    load("");
    inputRef.current?.focus();
  }, [load]);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.panel} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>◈ GIF</span>
          <button className={styles.closeBtn} onClick={onClose} type="button">✕</button>
        </div>

        {/* Search — Klipy requires "Search KLIPY" as placeholder per attribution guidelines */}
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search KLIPY"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
          />
          {query && (
            <button className={styles.clearBtn} type="button" onClick={() => setQuery("")}>✕</button>
          )}
        </div>

        {/* Label */}
        <div className={styles.sectionLabel}>
          {query.trim() ? `// RESULTS FOR "${query.trim().toUpperCase()}"` : "// TRENDING"}
        </div>

        {/* Grid */}
        <div className={styles.grid}>
          {loading && (
            <div className={styles.status}>LOADING...</div>
          )}
          {!loading && error && (
            <div className={styles.status}>
              {KLIPY_KEY ? "FAILED TO LOAD GIFS" : "MISSING VITE_KLIPY_API_KEY"}
            </div>
          )}
          {!loading && !error && gifs.length === 0 && (
            <div className={styles.status}>NO RESULTS</div>
          )}
          {!loading && !error && gifs.map((gif) => (
            <button
              key={gif.id}
              className={styles.gifBtn}
              type="button"
              title={gif.title}
              onClick={() => {
                onSelect(gif.url);
                onClose();
              }}
            >
              <img
                src={gif.preview}
                alt={gif.title}
                className={styles.gifImg}
                loading="lazy"
              />
            </button>
          ))}
        </div>

        {/* Footer — Klipy attribution requirement */}
        <div className={styles.footer}>
          Powered by KLIPY
        </div>
      </div>
    </div>
  );
}