import SummaryCard from "./SummaryCard";

function DashboardSummary({ summary }) {
    return (
        <section aria-labelledby="dashboard-summary-heading">
            <div className="section-heading">
                <h2 id="dashboard-summary-heading">Objective summary</h2>
            </div>

            <div className="summary-grid">
                <SummaryCard
                    title="Total Objectives"
                    value={summary.totalObjectives}
                    description="All active and completed objectives"
                />

                <SummaryCard
                    title="Completed"
                    value={summary.completedObjectives}
                    description="Objectives completed successfully"
                />

                <SummaryCard
                    title="On Track"
                    value={summary.onTrackObjectives}
                    description="Objectives progressing as expected"
                />

                <SummaryCard
                    title="At Risk"
                    value={summary.atRiskObjectives}
                    description="Objectives requiring attention"
                />

                <SummaryCard
                    title="Overdue"
                    value={summary.overdueObjectives}
                    description="Objectives past their due date"
                />
            </div>
        </section>
    );
}

export default DashboardSummary;