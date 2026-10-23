import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import {
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { getGlanceCharts } from "../../features/objectives/dashboardStats";

const CHARTS_PER_PAGE = 2;
// The kiosk display moves to the next chart page every 30 seconds
const KIOSK_PAGE_MS = 30 * 1000;

// framer-motion's animated div (aliased so ESLint sees it used in JSX)
const MotionDiv = motion.div;

// Chart pages slide in from the side they're coming from
const slide = {
  enter: (direction) => ({ x: direction > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? "-100%" : "100%", opacity: 0 }),
};

// Slices worth drawing (a chart with none is hidden)
const slicesOf = (data) => data.filter((item) => item.count > 0);

// One donut chart; clicking a slice selects it.
// "large" charts (kiosk) grow to fill the space they're given.
function DashboardDonut({ title, data, centerLabel, selectedKey, onSelect, large }) {
  const slices = slicesOf(data);

  return (
    <div className="chart-panel">
      <h4>{title}</h4>
      <div className="donut-area">
        <ResponsiveContainer width="100%" height={large ? "100%" : 280}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="count"
              nameKey="label"
              innerRadius={large ? "55%" : 70}
              outerRadius={large ? "80%" : 100}
              paddingAngle={2}
              onClick={(_, index) => onSelect(slices[index])}
            >
              {slices.map((item) => (
                <Cell
                  key={item.key}
                  fill={item.color}
                  className="chart-slice"
                  stroke={item.key === selectedKey ? "#1f1e40" : undefined}
                  strokeWidth={item.key === selectedKey ? 3 : 1}
                />
              ))}
              <Label value={centerLabel} position="center" className="donut-label" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Tile labels, numbers and notes for each time frame.
// All time counts objectives. The week views count the key results due that week
// (this week includes overdue ones carried over), and the at risk note says which
// objectives are themselves due that week and how they're tracking.
function getTiles(stats, timeFrame) {
  const week = stats.week;

  if (week) {
    const when = timeFrame === "next-week" ? "Next Week" : "This Week";
    // Relevant objectives by their most urgent statuses (see getAffectedObjectives)
    const affected =
      week.affectedObjectives.length === 0
        ? "No relevant objectives"
        : `Objectives Affected: ${week.affectedObjectives
            .map((item) => `${item.count} ${item.label.toLowerCase()}`)
            .join(", ")}`;

    return {
      total: { label: `Key Results Due ${when}`, value: week.keyResults },
      totalNote:
        week.overdue > 0
          ? `Includes ${week.overdue} overdue`
          : `Across ${plural(stats.total, "objective")}`,
      completed: {
        label: timeFrame === "next-week" ? "Completed Early" : "KRs Completed For This Week",
        value: `${week.completedPct}%`,
      },
      completedNote: `${week.completed} of ${plural(week.keyResults, "key result")}`,
      urgent: { label: `KRs At Risk ${when}`, value: week.atRisk },
      urgentNote: affected,
    };
  }

  const groups = `Across ${plural(stats.groupCount, "group")}`;
  const notStarted = stats.notStarted > 0 ? `, ${stats.notStarted} not started` : "";

  return {
    total: { label: "Total Objectives", value: stats.total },
    totalNote: `${groups}${notStarted}`,
    completed: { label: "Completed", value: `${stats.completedPct}%` },
    completedNote: `${stats.completed} of ${plural(stats.total, "objective")}`,
    urgent: { label: "Urgent Objectives", value: stats.atRisk },
    urgentNote: stats.overdue > 0 ? `${stats.overdue} overdue` : "Need attention now",
  };
}

// The At a Glance box: stat tiles and paged donut charts.
// On the dashboard it has a button to open the kiosk display;
// on the kiosk display (kiosk) it pages through the charts by itself.
function AtAGlance({ stats, timeFrame, selected, onSelectSlice, selectionList, kiosk, onOpenKiosk }) {
  const tiles = getTiles(stats, timeFrame);
  const [[chartPage, direction], setChartPage] = useState([0, 1]);

  // Charts with nothing to show are dropped, so later charts move up (including onto page 1)
  const shownCharts = getGlanceCharts(stats).filter(
    (chart) => slicesOf(chart.data).length > 0
  );
  const pageCount = Math.max(1, Math.ceil(shownCharts.length / CHARTS_PER_PAGE));
  const currentChartPage = Math.min(chartPage, pageCount - 1);
  const visibleCharts = shownCharts.slice(
    currentChartPage * CHARTS_PER_PAGE,
    (currentChartPage + 1) * CHARTS_PER_PAGE
  );

  function goToPage(page) {
    setChartPage([page, page > currentChartPage ? 1 : -1]);
  }

  // Kiosk: next page every 30 seconds, looping back to page 1 (still sliding forwards)
  useEffect(() => {
    if (!kiosk || pageCount <= 1) return undefined;
    const timer = setInterval(() => {
      setChartPage(([page]) => [(Math.min(page, pageCount - 1) + 1) % pageCount, 1]);
    }, KIOSK_PAGE_MS);
    return () => clearInterval(timer);
  }, [kiosk, pageCount]);

  return (
    <div className="completion-overview">
      <div className="glance-header">
        <h3>{kiosk ? "Business Objectives and Key Results" : "At a Glance"}</h3>
        {!kiosk && (
          <button
            type="button"
            className="fullscreen-button"
            onClick={onOpenKiosk}
            aria-label="Open kiosk display"
            title="Open kiosk display in a new tab"
          >
            <FullscreenIcon />
          </button>
        )}
      </div>
      <div className="statistics statistics-compact">
          <div className="card cards-blue">
            <div className="cards-line"></div>
            <p>{tiles.total.label}</p>
            <h2>{tiles.total.value}</h2>
            <span>{tiles.totalNote}</span>

          </div>

          <div className="card cards-green">
            <div className="cards-line"></div>
            <p>{tiles.completed.label}</p>
            <h2>{tiles.completed.value}</h2>
            <span>{tiles.completedNote}</span>

          </div>

          <div className="card cards-navy">
            <div className="cards-line"></div>
            <p>{tiles.urgent.label}</p>
            <h2>{tiles.urgent.value}</h2>
            <span>{tiles.urgentNote}</span>

          </div>
      </div>

      {shownCharts.length === 0 ? (
        <p>No relevant objectives or key results.</p>
      ) : (
        <div className="chart-pager">
          {pageCount > 1 && (
            <button
              type="button"
              aria-label="Previous charts"
              disabled={currentChartPage === 0}
              onClick={() => goToPage(currentChartPage - 1)}
            >
              &lsaquo;
            </button>
          )}
          <div className="graph-viewport">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <MotionDiv
                key={currentChartPage}
                className="graph-container"
                custom={direction}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                {visibleCharts.map((chart) => (
                  <DashboardDonut
                    key={chart.id}
                    title={chart.title}
                    data={chart.data}
                    centerLabel={chart.centerLabel}
                    selectedKey={selected?.chart === chart.id ? selected.key : null}
                    onSelect={(slice) => onSelectSlice(chart.id, slice)}
                    large={kiosk}
                  />
                ))}
              </MotionDiv>
            </AnimatePresence>
          </div>
          {pageCount > 1 && (
            <button
              type="button"
              aria-label="More charts"
              disabled={currentChartPage >= pageCount - 1}
              onClick={() => goToPage(currentChartPage + 1)}
            >
              &rsaquo;
            </button>
          )}
        </div>
      )}

      {selectionList}
    </div>
  );
}

export default AtAGlance;
