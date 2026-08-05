import React from "react";

import { mockOkrDashboardData } from "../data/mockOkrDashboardData";
import OkrDashboardSummary from "../components/okrdashboard/OkrDashboardSummary";

function OkrDashboard(){
  const {summary, objectives, upcomingDeadlines} = mockOkrDashboardData;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>View the current Objectives progress</p>

      <p>Total Objectives: {summary.totalObjectives}</p>
      <p>Average Progress: {summary.averageProgress}%</p>

      <p>Objectives loaded: {objectives.length}</p>
      <p>Upcoming Deadlines: {upcomingDeadlines.length}</p>
    </div>

  );

}
export default OkrDashboard;