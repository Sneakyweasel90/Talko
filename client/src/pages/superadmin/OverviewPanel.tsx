import { useState, useEffect, useLayoutEffect, useRef } from "react";
import axios from "axios";
import config from "../../config";
import { useTheme } from "../../context/ThemeContext";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { Stats, ChartPoint } from "./types";
import { fillDays } from "./helpers";
import styles from "../SuperAdmin.module.css";

const CHART_HEIGHT = 160;

// Measures its own pixel width via a ref and only renders children once it
// has a real value — eliminates the recharts width(-1) warning entirely.
function ChartWrapper({
  children,
}: {
  children: (width: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height: CHART_HEIGHT }}>
      {width > 0 && children(width)}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipLabel}>{label}</div>
      <div className={styles.chartTooltipValue}>
        {payload[0].value.toLocaleString()}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`${styles.statCard} ${accent ? styles.statCardAccent : ""}`}
    >
      <div className={styles.statValue}>{value.toLocaleString()}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

export function OverviewPanel({ token }: { token: string }) {
  const { theme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [msgActivity, setMsgActivity] = useState<ChartPoint[]>([]);
  const [userActivity, setUserActivity] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${config.HTTP}/api/superadmin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${config.HTTP}/api/superadmin/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(([statsRes, activityRes]) => {
        setStats(statsRes.data);
        setMsgActivity(fillDays(activityRes.data.messages));
        setUserActivity(fillDays(activityRes.data.users));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className={styles.stateMsg}>LOADING STATS...</div>;
  if (!stats)
    return <div className={styles.stateMsg}>failed to load stats</div>;

  const xTickFormatter = (_: string, index: number) =>
    index % 5 === 0 ? _ : "";

  const tickStyle = {
    fill: theme.textDim,
    fontSize: 10,
    fontFamily: "Share Tech Mono, monospace",
  };

  return (
    <div className={styles.overviewPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>// OVERVIEW</span>
      </div>
      <div className={styles.overviewScroll}>
        <div className={styles.statsGrid}>
          <StatCard label="TOTAL USERS" value={stats.totalUsers} />
          <StatCard label="TOTAL MESSAGES" value={stats.totalMessages} />
          <StatCard label="COMMUNITIES" value={stats.totalCommunities} />
          <StatCard
            label="BANNED USERS"
            value={stats.bannedUsers}
            accent={stats.bannedUsers > 0}
          />
          <StatCard label="MESSAGES — 24H" value={stats.messagesLast24h} />
          <StatCard label="NEW USERS — 7D" value={stats.newUsersLast7d} />
        </div>

        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              // MESSAGE ACTIVITY — 30 DAYS
            </div>
            <ChartWrapper>
              {(w) => (
                <AreaChart width={w} height={CHART_HEIGHT} data={msgActivity}>
                  <defs>
                    <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={theme.primary}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor={theme.primary}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={theme.primary}
                    strokeWidth={2}
                    fill="url(#msgGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: theme.primary }}
                  />
                </AreaChart>
              )}
            </ChartWrapper>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              // USER REGISTRATIONS — 30 DAYS
            </div>
            <ChartWrapper>
              {(w) => (
                <BarChart width={w} height={CHART_HEIGHT} data={userActivity}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="count"
                    fill={theme.primaryGlow}
                    stroke={theme.primaryDim}
                    strokeWidth={1}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              )}
            </ChartWrapper>
          </div>
        </div>
      </div>
    </div>
  );
}
