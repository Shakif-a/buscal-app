// Status order, labels and colours used by the dashboard donut
export const STATUSES = [
  { status: "on-track", label: "On Track", color: "#72cdf4" },
  { status: "completed", label: "Completed", color: "#00b085" },
  { status: "at-risk", label: "At Risk", color: "#1f1e40" },
  { status: "overdue", label: "Overdue", color: "#e05a5a" },
];

// Summarise a list of objectives for the OKR dashboard
export function getDashboardStats(objectives = []) {
  const total = objectives.length;
  const counts = {};
  const groups = [];

  for (const objective of objectives) {
    counts[objective.status] = (counts[objective.status] || 0) + 1;

    const name =
      !objective.group || objective.group === "none"
        ? "Ungrouped"
        : objective.group;
    let group = groups.find((item) => item.name === name);
    if (!group) {
      group = { name, objectives: 0, progress: 0 };
      groups.push(group);
    }
    group.objectives++;
    group.progress += objective.progress || 0;
  }

  for (const group of groups)
    group.progress = Math.round(group.progress / group.objectives);
  groups.sort((a, b) => a.name.localeCompare(b.name));

  const completed = counts["completed"] || 0;

  return {
    total,
    groupCount: groups.length,
    completed,
    completedPct: total ? Math.round((completed / total) * 100) : 0,
    atRisk: (counts["at-risk"] || 0) + (counts["overdue"] || 0),
    overdue: counts["overdue"] || 0,
    statusCounts: STATUSES.map((item) => ({
      ...item,
      count: counts[item.status] || 0,
    })),
    groups,
  };
}
