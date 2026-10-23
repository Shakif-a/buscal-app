// Status order, labels and colours used by the dashboard donuts
// (colours match ObjectiveCard, EntryViewer and KeyResultsModal; "not started" is the
// grey another branch is moving those to, so it stands apart from the yellow "at risk")
export const STATUSES = [
  { key: "completed", label: "Completed", color: "#00b085" },
  { key: "on-track", label: "On Track", color: "#72cdf4" },
  { key: "not started", label: "Not Started", color: "#9ca3af" },
  { key: "at-risk", label: "At Risk", color: "#f4b400" },
  { key: "overdue", label: "Overdue", color: "#e57373" },
];

export const KEY_RESULT_STATUSES = [
  { key: "completed", label: "Completed", color: "#00b085" },
  { key: "in-progress", label: "In Progress", color: "#72cdf4" },
  { key: "at-risk", label: "At Risk", color: "#f4b400" },
  { key: "overdue", label: "Overdue", color: "#e57373" },
];

export const COMMITMENT_TYPES = [
  { key: "committed", label: "Committed", color: "#1f1e40" },
  { key: "aspirational", label: "Aspirational", color: "#72cdf4" },
];

// Colours cycled through for charts without fixed categories (e.g. groups)
const PALETTE = ["#72cdf4", "#1f1e40", "#00b085", "#e5a673", "#f4b400", "#e57373"];

// Colour key for the deadline and approval lists:
// light blue is your own work (listed first), navy is work you oversee as a manager
export const DEADLINE_ROLES = [
  { key: "mine", label: "Assigned to you", color: "#72cdf4" },
  { key: "managing", label: "Managing", color: "#1f1e40" },
];

export const APPROVAL_ROLES = [
  { key: "waiting", label: "Awaiting approval", color: "#72cdf4" },
  { key: "action", label: "Approval actionable", color: "#1f1e40" },
];

export const SCOPES = [
  { key: "all", label: "All" },
  { key: "groups", label: "My groups" },
  { key: "mine", label: "Mine" },
];

export const TIME_FRAMES = [
  { key: "all", label: "All" },
  { key: "this-week", label: "This week" },
  { key: "next-week", label: "Next week" },
];

const UPCOMING_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

// Weeks run Monday to Sunday (weekend deadlines still get done in the working week).
// This week also takes anything unfinished from before it (carryOver), so it shows
// everything that needs doing now. Next week is future planning only.
export function getTimeFrameRange(timeFrame, now = new Date()) {
  if (timeFrame !== "this-week" && timeFrame !== "next-week") return null;

  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const start = new Date(monday);
  const end = new Date(monday);
  if (timeFrame === "this-week") {
    end.setDate(end.getDate() + 7);
  } else {
    start.setDate(start.getDate() + 7);
    end.setDate(end.getDate() + 14);
  }

  // end is exclusive (the midnight after the last day)
  return {
    start: start.getTime(),
    end: end.getTime(),
    carryOver: timeFrame === "this-week",
  };
}

function isDueIn(item, range, completed) {
  if (!range) return true;
  const due = new Date(item.dueDate).getTime();
  if (due >= range.end) return false;
  return due >= range.start || (range.carryOver && !completed);
}

// Whether the objective's own due date is in the time frame
function isObjectiveDueIn(objective, range) {
  return isDueIn(objective, range, objective.status === "completed");
}

// Local calendar day, so items due the same day can be ordered by role
function dayOf(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

// Sort by due day, then light blue (your own) items before navy ones
function byDayThenRole(firstRole) {
  return (a, b) =>
    dayOf(a.dueDate) - dayOf(b.dueDate) ||
    (a.role === b.role ? 0 : a.role === firstRole ? -1 : 1) ||
    new Date(a.dueDate) - new Date(b.dueDate);
}

function groupName(objective) {
  return !objective.group || objective.group === "none"
    ? "Ungrouped"
    : objective.group;
}

function keyResultStatus(keyResult) {
  // key results saved before the rename may still say "on-track"
  if (keyResult.approved) return "completed";
  return keyResult.status === "on-track" ? "in-progress" : keyResult.status;
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function withCounts(categories, counts) {
  return categories.map((item) => ({ ...item, count: counts[item.key] || 0 }));
}

// Pick the objectives and key results the selected scope and time frame cover.
// "mine" means objectives I own (with all their key results) plus any key result assigned to me.
// A time frame keeps key results due inside it, and objectives that are due inside it
// themselves or have one of those key results.
export function filterByScope(objectives = [], scope = "all", timeFrame = "all", now = new Date()) {
  const range = getTimeFrameRange(timeFrame, now);
  const scopedObjectives = [];
  const keyResults = [];

  for (const objective of objectives) {
    let objectiveKeyResults = objective.keyResults || [];
    let included = true;

    if (scope === "groups") {
      included = Boolean(objective.inMyGroups);
    } else if (scope === "mine" && !objective.isOwner) {
      objectiveKeyResults = objectiveKeyResults.filter((kr) => kr.isAssignedToMe);
      included = objectiveKeyResults.length > 0;
    }

    if (!included) continue;

    const dueKeyResults = objectiveKeyResults.filter((keyResult) =>
      isDueIn(keyResult, range, keyResultStatus(keyResult) === "completed")
    );

    if (dueKeyResults.length > 0 || isObjectiveDueIn(objective, range)) {
      scopedObjectives.push(objective);
    }
    for (const keyResult of dueKeyResults) {
      keyResults.push({
        ...keyResult,
        objectiveId: objective.id || objective._id,
        objectiveTitle: objective.title,
      });
    }
  }

  return { objectives: scopedObjectives, keyResults };
}

// The objective statuses worth calling out, most urgent first:
// overdue and at risk; if none, not started; if none of those, on track and completed
const AFFECTED_TIERS = [["overdue", "at-risk"], ["not started"], ["on-track", "completed"]];

function getAffectedObjectives(objectives) {
  const counts = withCounts(
    STATUSES,
    countBy(objectives, (objective) => objective.status),
  );

  for (const tier of AFFECTED_TIERS) {
    const found = tier
      .map((key) => counts.find((item) => item.key === key))
      .filter((item) => item.count > 0);
    if (found.length > 0) return found;
  }
  return [];
}

// Summarise objectives and key results for the OKR dashboard
export function getDashboardStats(
  objectives = [],
  keyResults = [],
  now = new Date(),
  timeFrame = "all",
) {
  const total = objectives.length;
  const statusTotals = countBy(objectives, (objective) => objective.status);
  const groups = [];

  for (const objective of objectives) {
    const name = groupName(objective);
    let group = groups.find((item) => item.name === name);
    if (!group) {
      group = { name, objectives: 0, progress: 0, statuses: {} };
      groups.push(group);
    }
    group.objectives++;
    group.progress += objective.progress || 0;
    group.statuses[objective.status] = (group.statuses[objective.status] || 0) + 1;
  }

  groups.sort((a, b) => a.name.localeCompare(b.name));
  for (const group of groups) {
    group.progress = Math.round(group.progress / group.objectives);
    group.statusCounts = withCounts(STATUSES, group.statuses);
    delete group.statuses;
  }

  const completed = statusTotals["completed"] || 0;

  // Week views measure the key results due that week, plus which objectives are due themselves
  const range = getTimeFrameRange(timeFrame, now);
  let week = null;
  if (range) {
    const krTotals = countBy(keyResults, keyResultStatus);
    const krCompleted = krTotals["completed"] || 0;

    week = {
      keyResults: keyResults.length,
      overdue: krTotals["overdue"] || 0,
      completed: krCompleted,
      completedPct: keyResults.length ? Math.round((krCompleted / keyResults.length) * 100) : 0,
      atRisk: krTotals["at-risk"] || 0,
      affectedObjectives: getAffectedObjectives(objectives),
    };
  }

  // Not completed and due within the next couple of weeks,
  // including anything already overdue so it stays in view
  const cutoff = dayOf(now) + (UPCOMING_DAYS + 1) * DAY;
  const isUpcoming = (item, status) => {
    const due = new Date(item.dueDate).getTime();
    return status !== "completed" && due < cutoff;
  };

  const upcoming = [
    ...objectives
      .filter((objective) => isUpcoming(objective, objective.status))
      .map((objective) => ({
        id: objective.id || objective._id,
        kind: "Objective",
        title: objective.title,
        dueDate: objective.dueDate,
        status: objective.status,
        progress: objective.progress || 0,
        role: objective.isOwner ? "mine" : "managing",
      })),
    ...keyResults
      .filter((kr) => isUpcoming(kr, keyResultStatus(kr)))
      .map((kr) => ({
        id: kr.id || kr._id,
        kind: "Key Result",
        title: kr.title,
        parent: kr.objectiveTitle,
        dueDate: kr.dueDate,
        status: keyResultStatus(kr),
        progress: kr.progress || 0,
        role: kr.isAssignedToMe ? "mine" : "managing",
      })),
  ].sort(byDayThenRole("mine"));

  return {
    total,
    groupCount: groups.length,
    completed,
    completedPct: total ? Math.round((completed / total) * 100) : 0,
    atRisk: (statusTotals["at-risk"] || 0) + (statusTotals["overdue"] || 0),
    overdue: statusTotals["overdue"] || 0,
    notStarted: statusTotals["not started"] || 0,
    week,
    statusCounts: withCounts(STATUSES, statusTotals),
    totalKeyResults: keyResults.length,
    keyResultCounts: withCounts(
      KEY_RESULT_STATUSES,
      countBy(keyResults, keyResultStatus),
    ),
    groupCounts: groups.map((group, index) => ({
      key: group.name,
      label: group.name,
      color: PALETTE[index % PALETTE.length],
      count: group.objectives,
    })),
    commitmentCounts: withCounts(
      COMMITMENT_TYPES,
      countBy(objectives, (objective) => objective.commitmentType || "committed"),
    ),
    groups,
    // Finished, unapproved key results I can approve, or my own waiting on someone above me
    awaitingApproval: keyResults
      .filter((kr) => (kr.progress || 0) >= 100 && !kr.approved)
      .map((kr) => ({
        ...kr,
        role: kr.canApprove ? "action" : kr.isAssignedToMe ? "waiting" : null,
      }))
      .filter((kr) => kr.role)
      .sort(byDayThenRole("waiting")),
    upcoming,
  };
}

// Items behind a clicked chart slice, for the list under the charts
export function getSliceItems({ objectives, keyResults }, chart, key) {
  if (chart === "keyResults") {
    return keyResults
      .filter((kr) => keyResultStatus(kr) === key)
      .map((kr) => ({
        id: kr.id || kr._id,
        title: kr.title,
        detail: `${kr.objectiveTitle} · ${kr.assigned || "Unassigned"}`,
        dueDate: kr.dueDate,
        progress: kr.progress || 0,
      }));
  }

  // group bar segments use "<group>::<status>" as their key
  const separator = key.lastIndexOf("::");
  const segment = { group: key.slice(0, separator), status: key.slice(separator + 2) };

  const matches = {
    groupStatus: (objective) =>
      groupName(objective) === segment.group && objective.status === segment.status,
    objectives: (objective) => objective.status === key,
    groups: (objective) => groupName(objective) === key,
    commitment: (objective) => (objective.commitmentType || "committed") === key,
  }[chart];

  if (!matches) return [];

  return objectives.filter(matches).map((objective) => ({
    id: objective.id || objective._id,
    title: objective.title,
    detail: `${groupName(objective)} · ${objective.manager || ""}`,
    dueDate: objective.dueDate,
    progress: objective.progress || 0,
  }));
}

// The donut charts At a Glance can show, in page order
export function getGlanceCharts(stats) {
  return [
    {
      id: "objectives",
      title: "Objective Status",
      data: stats.statusCounts,
      centerLabel: `${stats.completedPct}% Completed`,
    },
    {
      id: "keyResults",
      title: "Key Result Status",
      data: stats.keyResultCounts,
      centerLabel: `${stats.totalKeyResults} Key Results`,
    },
    {
      id: "groups",
      title: "Objectives By Group",
      data: stats.groupCounts,
      centerLabel: `${stats.total} Objectives`,
    },
    {
      id: "commitment",
      title: "Committed vs Aspirational",
      data: stats.commitmentCounts,
      centerLabel: `${stats.total} Objectives`,
    },
  ];
}
