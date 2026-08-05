export const mockOkrDashboardData = {
    summary: [{
        totalObjectives: 18,
        completeObjectives: 5,
        onTrackObjectives: 8,
        atRiskObjectives: 3,
        overdueObjectives: 2,
        averageObjectives 61
    }]

    objectives:[
        {
        id: "obj-001",
        title: "Title",
        ownerName: "Name",
        groupName: "GName",
        progress: 70,
        statue: "On Track",
        dueDate: "2026-09-30"
        },
        {
        id: "obj-002",
        title: "Title2",
        ownerName: "Name",
        groupName: "GName",
        progress: 50,
        statue: "At Risk",
        dueDate: "2026-08-11"
        }
    ],

    upcomingDeadlines: [
        {
            id: "obj-002",
            title: "Title2",
            dueDate: "2026-08-11",
            ownerName: "Name",
            statue: "At Risk"
        }
    ]
};
