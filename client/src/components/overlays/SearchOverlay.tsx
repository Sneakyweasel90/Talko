import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import config from "../../config";
import type { SearchResult } from "../../types";
import styles from "./SearchOverlay.module.css";

interface ContextMessage {
  id: number;
  username: string;
  content: string;
  created_at: string;
  position: "before" | "target" | "after";
}

interface Props {
  token: string;
  currentChannel: string;
  onJumpTo: (channelId: string, messageId: number) => void;
  onClose: () => void;
}

export default function SearchOverlay({
  token,
  currentChannel,
  onJumpTo,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [scopeChannel, setScopeChannel] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [contextMap, setContextMap] = useState<
    Record<number, ContextMessage[]>
  >({});
  const [contextLoading, setContextLoading] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      setExpandedId(null);
      try {
        const params: Record<string, string> = { q };
        if (scopeChannel) params.channel = currentChannel;
        const { data } = await axios.get(`${config.HTTP}/api/search`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [token, scopeChannel, currentChannel],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  useEffect(() => {
    if (query.trim().length >= 2) doSearch(query);
  }, [scopeChannel]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  const handleExpandContext = useCallback(
    async (result: SearchResult) => {
      if (expandedId === result.id) {
        setExpandedId(null);
        return;
      }
      setExpandedId(result.id);
      if (contextMap[result.id]) return;
      setContextLoading(result.id);
      try {
        const { data } = await axios.get(`${config.HTTP}/api/search/context`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            messageId: result.id,
            channel: result.channel_id,
            around: 4,
          },
        });
        setContextMap((prev) => ({ ...prev, [result.id]: data }));
      } catch {
        // silently fail
      } finally {
        setContextLoading(null);
      }
    },
    [expandedId, contextMap, token],
  );

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text;
    const regex = new RegExp(
      `(${q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    return text.split(regex).map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className={styles.highlight}>
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKey}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.searchHeader}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder="search messages..."
          />
          <button
            className={`${styles.scopeBtn} ${scopeChannel ? styles.active : ""}`}
            onClick={() => setScopeChannel((s) => !s)}
            title={
              scopeChannel
                ? "Searching current channel — click for all"
                : "Searching all channels — click for current only"
            }
          >
            {scopeChannel ? `#${currentChannel}` : "ALL CHANNELS"}
          </button>
        </div>

        {/* Results */}
        <div className={styles.results}>
          {loading && <div className={styles.statusText}>searching...</div>}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className={styles.statusText}>no results found</div>
          )}

          {results.map((r) => {
            const isExpanded = expandedId === r.id;
            const ctxMessages = contextMap[r.id] ?? [];
            const isCtxLoading = contextLoading === r.id;

            return (
              <div key={r.id} className={styles.resultItem}>
                <div
                  className={`${styles.resultRow} ${isExpanded ? styles.expanded : ""}`}
                >
                  <div className={styles.resultMeta}>
                    <div className={styles.resultMetaLeft}>
                      <span className={styles.resultAuthor}>{r.username}</span>
                      <span className={styles.resultChannel}>
                        #{r.channel_id}
                      </span>
                      <span className={styles.resultTime}>
                        {formatTime(r.created_at)}
                      </span>
                    </div>
                    <div className={styles.resultActions}>
                      <button
                        className={`${styles.ctxBtn} ${isExpanded ? styles.active : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExpandContext(r);
                        }}
                        title={
                          isExpanded
                            ? "Hide context"
                            : "Show surrounding messages"
                        }
                      >
                        {isCtxLoading
                          ? "..."
                          : isExpanded
                            ? "▲ CONTEXT"
                            : "▼ CONTEXT"}
                      </button>
                      <button
                        className={styles.jumpBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpTo(r.channel_id, r.id);
                          onClose();
                        }}
                        title="Jump to message"
                      >
                        JUMP →
                      </button>
                    </div>
                  </div>
                  <div className={styles.resultContent}>
                    {highlight(r.content, query)}
                  </div>
                </div>

                {/* Context panel */}
                {isExpanded && ctxMessages.length > 0 && (
                  <div className={styles.contextPanel}>
                    <div className={styles.contextLabel}>
                      // SURROUNDING CONTEXT
                    </div>
                    {ctxMessages.map((cm) => {
                      const isTarget = cm.position === "target";
                      return (
                        <div
                          key={cm.id}
                          className={`${styles.contextMsg} ${isTarget ? styles.target : ""}`}
                        >
                          <span className={styles.contextMsgAuthor}>
                            {cm.username}
                          </span>
                          <span className={styles.contextMsgContent}>
                            {isTarget
                              ? highlight(cm.content, query)
                              : cm.content}
                          </span>
                        </div>
                      );
                    })}
                    <button
                      className={styles.contextJumpBtn}
                      onClick={() => {
                        onJumpTo(r.channel_id, r.id);
                        onClose();
                      }}
                    >
                      JUMP TO CHANNEL →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span>ESC to close</span>
          <span>▼ CONTEXT to preview surrounding messages</span>
          <span>JUMP → to navigate</span>
        </div>
      </div>
    </div>
  );
}
