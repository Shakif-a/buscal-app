import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { getObjectives } from "../../features/objectives/objectiveSlice";
import { getDashboardStats } from "../../features/objectives/dashboardStats";
import "./OkrDashboard.css";

function OkrDashboard(){
  const dispatch = useDispatch();
  const { objectives, isLoading, isError, message } = useSelector(
    (state) => state.okr
  );

  useEffect(() => {
    dispatch(getObjectives());
  }, [dispatch]);

  const stats = useMemo(() => getDashboardStats(objectives), [objectives]);
  const chartData = stats.statusCounts.filter((item) => item.count > 0);

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

      <div className="statistics">
          <div className="card cards-blue">
            <div className="cards-line"></div>
            <p>Total Objectives</p>
            <h2>{stats.total}</h2>
            <span>
              Across {stats.groupCount} group{stats.groupCount === 1 ? "" : "s"}
              {stats.notStarted > 0 && `, ${stats.notStarted} not started`}
            </span>

          </div>

          <div className="card cards-green">
            <div className="cards-line"></div>
            <p>Completed</p>
            <h2>{stats.completedPct}%</h2>
            <span>{stats.completed} of {stats.total} objectives</span>

          </div>

          <div className="card cards-navy">
            <div className="cards-line"></div>
            <p>At Risk Objectives</p>
            <h2>{stats.atRisk}</h2>
            <span>
              {stats.overdue > 0
                ? `${stats.overdue} overdue, need attention`
                : "Need attention now"}
            </span>

          </div>
      </div>

      <div className="bottom-section">
          <div className="week-statistics">
            <h3>Progress By Group</h3>

            {stats.groups.length === 0 && <p>No objectives yet.</p>}
            {stats.groups.map((group, index) => (
              <div className={`progress-row bar-${index % 4}`} key={group.name}>
                <span>{group.name}</span>
                <progress value={group.progress} max="100"></progress>
                <span>{group.progress}%</span>
              </div>
            ))}
          </div>

      </div>

      <div className="completion-overview">
        <h3>Completion Overview</h3>
        {chartData.length === 0 ? (
          <p>No objectives yet.</p>
        ) : (
          <div className="graph-container">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {chartData.map((item) => (
                    <Cell key={item.status} fill={item.color} />
                  ))}
                  <Label
                    value={`${stats.completedPct}% Completed`}
                    position="center"
                    className="donut-label"
                  />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>

    </div>

  );

}
export default OkrDashboard;
