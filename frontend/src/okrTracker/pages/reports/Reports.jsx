import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import reportService from "../../features/objectives/reportService";
import "./Reports.css";

// The report as rows: a header row, then one row per key result with its objective's
// details repeated, so the CSV works as a single table for other programs.
// Objectives without key results get one row with the key result columns left blank.
// Dates are YYYY-MM-DD and numbers are plain (no % sign) so they stay machine readable.
// The page shows these same rows, so what's on screen matches the export.
const formatDate = (date) => {
  const parsed = new Date(date);
  return date && !isNaN(parsed) ? parsed.toISOString().slice(0, 10) : "";
};
const round = (value) => Math.round((Number(value) || 0) * 10) / 10;

const HEADER = [
  "Objective ID",
  "Objective",
  "Group",
  "Owner",
  "Type",
  "Objective Due Date",
  "Objective Status",
  "Objective Progress (%)",
  "Key Result ID",
  "Key Result",
  "Assigned To",
  "Weight (%)",
  "Key Result Due Date",
  "Key Result Status",
  "Key Result Progress (%)",
  "Approved",
];

function buildReportRows(report) {
  const rows = [HEADER];
  for (const objective of report.objectives || []) {
    const objectiveColumns = [
      objective.id,
      objective.title,
      objective.group,
      objective.owner,
      objective.commitmentType,
      formatDate(objective.dueDate),
      objective.status,
      round(objective.progress),
    ];
    if (objective.keyResults.length === 0) {
      rows.push([...objectiveColumns, "", "", "", "", "", "", "", ""]);
    }
    for (const keyResult of objective.keyResults) {
      rows.push([
        ...objectiveColumns,
        keyResult.id,
        keyResult.title,
        keyResult.assigned,
        keyResult.weight,
        formatDate(keyResult.dueDate),
        keyResult.status,
        round(keyResult.progress),
        keyResult.approved ? "yes" : "no",
      ]);
    }
  }
  return rows;
}

function Reports() {
  const { user } = useSelector((state) => state.auth);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  useEffect(() => {
    let active = true;
    setReport(null);
    setError("");
    reportService
      .getReport(user.token)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((failure) => {
        // No View Reports permission
        if (active && failure.response?.status === 403) {
          setForbidden(true);
          return;
        }
        if (active)
          setError(
            failure.response?.data?.message ||
              failure.message ||
              "Could not load reports",
          );
      });
    return () => {
      active = false;
    };
  }, [user.token]);

  const rows = report ? buildReportRows(report) : [];

  if (forbidden) return <Navigate to="/dashboard/okrtracker/okrdashboard" replace />;

  function exportReport() {
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? "");
            // stop spreadsheet apps treating text as a formula
            if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
          })
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `okr-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="reports">
      <div className="report-header">
        <div className="report-title">
          <img
            src="/images/okr/ArrowLogoLeft.png"
            alt="Arrow Logo L"
            className="logo"
          />
          <h1>Reports</h1>
        </div>
        <img
          src="/images/okr/ArrowLogoRight.png"
          alt="Arrow Logo R"
          className="logo"
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p role="status">Loading reports...</p>}
      {report && (
        <>
          {rows.length === 1 ? (
            <p>No objectives yet.</p>
          ) : (
            <div className="report-table">
              <table>
                <thead>
                  <tr>
                    {rows[0].map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(1).map((row, index) => (
                    <tr key={`${row[0]}-${row[8] || index}`}>
                      {row.map((value, column) => (
                        <td key={rows[0][column]}>{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="export-container">
            <button className="export-button" onClick={exportReport}>
              Export Reports
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
