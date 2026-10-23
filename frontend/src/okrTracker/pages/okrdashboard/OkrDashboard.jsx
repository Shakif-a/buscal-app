import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getObjectives } from "../../features/objectives/objectiveSlice";
import {
  APPROVAL_ROLES,
  DEADLINE_ROLES,
  SCOPES,
  STATUSES,
  TIME_FRAMES,
  filterByScope,
  getDashboardStats,
  getGlanceCharts,
  getSliceItems,
} from "../../features/objectives/dashboardStats";
import AtAGlance from "./AtAGlance";
import "./OkrDashboard.css";

export const KIOSK_PATH = "/dashboard/okrtracker/okrdashboard/kiosk";

const LIST_PAGE_SIZE = 8;

const formatDate = (date) => new Date(date).toLocaleDateString("en-AU");

// Coloured left edge on a list row, from its role in the colour key
const roleStyle = (roles, role) => ({
  borderLeft: `4px solid ${roles.find((item) => item.key === role)?.color}`,
});

// Overdue and at-risk due dates get a coloured underline
const DUE_UNDERLINES = { overdue: "#e57373", "at-risk": "#f4b400" };

function dueDateStyle(status) {
  const color = DUE_UNDERLINES[status];
  return color
    ? { textDecoration: `underline 3px ${color}`, textUnderlineOffset: "4px" }
    : undefined;
}

// Rows for one page of a list
function pageOf(items, page) {
  return items.slice(page * LIST_PAGE_SIZE, (page + 1) * LIST_PAGE_SIZE);
}

// Small "< Page 1/2 >" control, based on the Objectives page pagination
function ListPager({ page, itemCount, onChange }) {
  const pageCount = Math.max(1, Math.ceil(itemCount / LIST_PAGE_SIZE));

  return (
    <div className="list-pager">
      <button
        type="button"
        className="page-button"
        aria-label="Previous page"
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
      >
        &lsaquo;
      </button>
      <span className="page-count">
        Page {page + 1}/{pageCount}
      </span>
      <button
        type="button"
        className="page-button"
        aria-label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
      >
        &rsaquo;
      </button>
    </div>
  );
}

// Colour key shown above the deadline and approval lists
function RoleKey({ roles }) {
  return (
    <div className="role-key">
      {roles.map((role) => (
        <span key={role.key}>
          <span className="role-swatch" style={{ background: role.color }} />
          {role.label}
        </span>
      ))}
    </div>
  );
}

// Group bars split by objective status; clicking a segment selects that group and status
function GroupProgressChart({ groups, selectedKey, onSelect }) {
  const rows = groups.map((group) => ({
    name: group.name,
    label: `${group.name} (${group.progress}%)`,
    ...Object.fromEntries(group.statusCounts.map((item) => [item.key, item.count])),
  }));
  // Only statuses some group actually has, so the legend stays short
  const statuses = STATUSES.filter((status) => rows.some((row) => row[status.key] > 0));

  return (
    <ResponsiveContainer width="100%" height={rows.length * 44 + 70}>
      <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={150} />
        <Tooltip />
        <Legend />
        {statuses.map((status) => (
          <Bar
            key={status.key}
            dataKey={status.key}
            name={status.label}
            stackId="status"
            fill={status.color}
            className="chart-slice"
            onClick={(_, index) => onSelect(rows[index], status)}
          >
            {rows.map((row) => {
              const isSelected = selectedKey === `${row.name}::${status.key}`;
              return (
                <Cell
                  key={row.name}
                  stroke={isSelected ? "#1f1e40" : undefined}
                  strokeWidth={isSelected ? 3 : 0}
                />
              );
            })}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Objectives or key results behind a clicked chart segment
function SelectionList({ title, label, items, onClear }) {
  return (
    <div className="dashboard-list">
      <h4>
        {title}: {label} ({items.length})
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </h4>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Details</th>
            <th>Due</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.detail}</td>
              <td>{formatDate(item.dueDate)}</td>
              <td>{Math.round(item.progress)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OkrDashboard(){
  const dispatch = useDispatch();
  const { objectives, isLoading, isError, message } = useSelector(
    (state) => state.okr
  );
  const [scope, setScope] = useState("all");
  const [timeFrame, setTimeFrame] = useState("all");
  const [selected, setSelected] = useState(null);
  const [deadlinePage, setDeadlinePage] = useState(0);
  const [approvalPage, setApprovalPage] = useState(0);

  useEffect(() => {
    dispatch(getObjectives());
  }, [dispatch]);

  const scoped = useMemo(
    () => filterByScope(objectives, scope, timeFrame),
    [objectives, scope, timeFrame]
  );
  const stats = useMemo(
    () => getDashboardStats(scoped.objectives, scoped.keyResults, new Date(), timeFrame),
    [scoped, timeFrame]
  );

  const selectedTitle =
    selected &&
    (selected.chart === "groupStatus"
      ? "Objective Progress By Group"
      : getGlanceCharts(stats).find((chart) => chart.id === selected.chart).title);
  const selectedItems = selected
    ? getSliceItems(scoped, selected.chart, selected.key)
    : [];
  const selectionList = selected && (
    <SelectionList
      title={selectedTitle}
      label={selected.label}
      items={selectedItems}
      onClear={() => setSelected(null)}
    />
  );

  // Keep the list pages in range when the lists get shorter
  const lastDeadlinePage = Math.max(0, Math.ceil(stats.upcoming.length / LIST_PAGE_SIZE) - 1);
  const lastApprovalPage = Math.max(0, Math.ceil(stats.awaitingApproval.length / LIST_PAGE_SIZE) - 1);
  const currentDeadlinePage = Math.min(deadlinePage, lastDeadlinePage);
  const currentApprovalPage = Math.min(approvalPage, lastApprovalPage);

  function resetView() {
    setSelected(null);
    setDeadlinePage(0);
    setApprovalPage(0);
  }

  function changeScope(nextScope) {
    setScope(nextScope);
    resetView();
  }

  function changeTimeFrame(nextTimeFrame) {
    setTimeFrame(nextTimeFrame);
    resetView();
  }

  // Kiosk display for a screen left on all day, with the same filters, in a new tab
  function openKiosk() {
    const query = new URLSearchParams({ scope, time: timeFrame });
    window.open(`${KIOSK_PATH}?${query}`, "_blank", "noopener");
  }

  function selectSlice(chartId, slice) {
    // clicking the selected slice again clears it
    if (selected && selected.chart === chartId && selected.key === slice.key) {
      setSelected(null);
    } else {
      setSelected({ chart: chartId, key: slice.key, label: slice.label });
    }
  }

  return (
    <div className="okrdashboard">

      <div className="dashboard-header">
          <div className="dashboard-title">
              {/*Arrow Logo */}
              <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"/>

              <h1>Dashboard</h1>

          </div>
              <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
      </div>

      {isError && <p role="alert">{message || "Could not load objectives"}</p>}
      {isLoading && objectives.length === 0 && (
        <p role="status">Loading objectives...</p>
      )}

      {/* Filters, styled like the Objectives page filters */}
      <div className="dashboard-filters">
        <select
          aria-label="Ownership"
          value={scope}
          onChange={(event) => changeScope(event.target.value)}
        >
          {SCOPES.map((item) => (
            <option key={item.key} value={item.key}>
              Ownership ({item.label})
            </option>
          ))}
        </select>

        <select
          aria-label="Time frame"
          value={timeFrame}
          onChange={(event) => changeTimeFrame(event.target.value)}
        >
          {TIME_FRAMES.map((item) => (
            <option key={item.key} value={item.key}>
              Time ({item.label})
            </option>
          ))}
        </select>
      </div>

      <AtAGlance
        stats={stats}
        timeFrame={timeFrame}
        selected={selected}
        onSelectSlice={selectSlice}
        selectionList={selected && selected.chart !== "groupStatus" && selectionList}
        onOpenKiosk={openKiosk}
      />

      <div className="bottom-section">
          <div className="week-statistics">
            <h3>Objective Progress By Group</h3>

            {stats.groups.length === 0 ? (
              <p>No relevant objectives.</p>
            ) : (
              <GroupProgressChart
                groups={stats.groups}
                selectedKey={selected?.chart === "groupStatus" ? selected.key : null}
                onSelect={(row, status) =>
                  selectSlice("groupStatus", {
                    key: `${row.name}::${status.key}`,
                    label: `${row.name}, ${status.label}`,
                  })
                }
              />
            )}
            {selected?.chart === "groupStatus" && selectionList}
          </div>

      </div>

      <div className="bottom-section">
        <div className="week-statistics">
          <h3>My Upcoming Deadlines</h3>
          <RoleKey roles={DEADLINE_ROLES} />
          {stats.upcoming.length === 0 ? (
            <p>No relevant deadlines.</p>
          ) : (
            <table className="dashboard-list">
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {pageOf(stats.upcoming, currentDeadlinePage).map((item) => (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td style={roleStyle(DEADLINE_ROLES, item.role)}>
                      <span style={dueDateStyle(item.status)} title={item.status}>
                        {formatDate(item.dueDate)}
                      </span>
                    </td>
                    <td>{item.kind}</td>
                    <td>
                      {item.title}
                      {item.parent && <small> ({item.parent})</small>}
                    </td>
                    <td>{Math.round(item.progress)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ListPager
            page={currentDeadlinePage}
            itemCount={stats.upcoming.length}
            onChange={setDeadlinePage}
          />
        </div>

        <div className="week-statistics">
          <h3>My Pending Approvals</h3>
          <RoleKey roles={APPROVAL_ROLES} />
          {stats.awaitingApproval.length === 0 ? (
            <p>No relevant approvals.</p>
          ) : (
            <table className="dashboard-list">
              <thead>
                <tr>
                  <th>Key Result</th>
                  <th>Objective</th>
                  <th>Assigned</th>
                </tr>
              </thead>
              <tbody>
                {pageOf(stats.awaitingApproval, currentApprovalPage).map((kr) => (
                  <tr key={kr.id || kr._id}>
                    <td style={roleStyle(APPROVAL_ROLES, kr.role)}>{kr.title}</td>
                    <td>{kr.objectiveTitle}</td>
                    <td>{kr.assigned || "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ListPager
            page={currentApprovalPage}
            itemCount={stats.awaitingApproval.length}
            onChange={setApprovalPage}
          />
        </div>
      </div>

    </div>

  );

}
export default OkrDashboard;
