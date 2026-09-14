import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import reportService from "../../features/objectives/reportService";
import "./Reports.css";

function Reports() {
  const { user } = useSelector((state) => state.auth);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
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

  function exportReport() {
    const rows = [["Group", "Objectives", "Average progress"]];
    for (const group of report.groups)
      rows.push([group.name, group.objectives, group.progress + "%"]);
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value);
            if (/^[=+@-]/.test(text)) text = "'" + text;
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
    link.download = "okr-report.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="reports">
      <div className="report-header">
        <h1>Reports</h1>
      </div>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p role="status">Loading reports...</p>}
      {report && (
        <>
          <div className="statistics">
            <div className="cards cards-blue">
              <p>Objectives On Track</p>
              <h2>{report.onTrack}</h2>
            </div>
            <div className="cards cards-green">
              <p>Average Progress</p>
              <h2>{report.averageProgress}%</h2>
            </div>
            <div className="cards cards-navy">
              <p>Total Objectives</p>
              <h2>{report.totalObjectives}</h2>
            </div>
          </div>
          <div className="week-statistics">
            <h3>Completion By Group</h3>
            {report.groups.length === 0 && <p>No objectives yet.</p>}
            {report.groups.map((group) => (
              <div className="progress-row" key={group.name}>
                <span>{group.name}</span>
                <progress value={group.progress} max="100" />
                <span>{group.progress}%</span>
              </div>
            ))}
          </div>
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
