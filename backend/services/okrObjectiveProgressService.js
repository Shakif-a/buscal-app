const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");

const AT_RISK_TOLERANCE = 10;

function getSydneyDate() {
    return new Int16Array.DateTimeFormat("en-CA", {
        timeZone: "Australia/Sydney",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

async function recalculateKeyResultStatuses(objectiveId) {
    const keyResults = await OkrKeyResult.find({
        objective: objectiveId,
    });

    const now = Date.now();
    const today = getSydneyDate();

    for (const kr of keyResults) {
        const progress = kr.progress ?? 0;
        const start = new Date(kr.createdAt).getTime();
        const end = new Date(kr.dueDate).getTime();
        //compare calendar dates rather than exact timestamps
        const dueDate = new Date(kr.dueDate)
            .toISOString()
            .split("T")[0];

        const isOverdue = today > dueDate;

        const duration = end - start;

        //expected progress based on kr timeline
        const expectedProgress = 
        duration <= 0
            ? now >= end ? 100 : 0
            : Math.max(
                0,
                Math.min(100, ((now - start) / duration) * 100)
            );
        let status = kr.status;

        //preserve completed kr
        if (kr.status === "completed" || kr.approved) {
            status = "completed";
        } else if (isOverdue) {
            status = "overdue";
        } else if (status === "in-progress" && progress < expectedProgress - AT_RISK_TOLERANCE) {
            status = "at-risk";
        }

        if (kr.status !== status) {
            kr.status = status;
            await kr.save();
        }
    }
}

async function recalculateObjective(objectiveId) {
    const objective = await OkrObjective.findById(objectiveId);

    if (!objective) {
        throw new Error("Objective not found");
    }

    //update key result status first
    await recalculateKeyResultStatuses(objectiveId);

    //fetch updated key results
    const keyResults = await OkrKeyResult.find({
        objective: objectiveId,
    });

    //Calculate weighted Objective Progress
    const weightedProgress = keyResults.reduce((total, kr) => {
        return total + kr.weight * kr.progress;
    }, 0);

    const progress = Math.max(
        0,
        Math.min(100, weightedProgress / 100)
    );

    //Calculate expected progress based on timeline
    const now = Date.now();
    const start = new Date(objective.createdAt).getTime();
    const end = new Date(objective.dueDate).getTime();

    const duration = end - start;

    const expectedProgress = 
        duration <= 0
            ? now >= end ? 100 : 0
            : Math.max(
                0,
                Math.min(100, ((now - start) /duration) * 100)
            );
    //Determine Objective Status
    let status;

    if (progress >= 100) {
        status = "completed";
    } else if (now > end) {
        status = "overdue";
    } else if (progress === 0) {
        status = "not started";
    } else if (progress < expectedProgress - AT_RISK_TOLERANCE) {
        status = "at-risk";
    } else {
        status = "on-track";
    }

    if (
        objective.progress !== progress ||
        objective.status !== status
    ) {
        objective.progress = progress;
        objective.status = status;

        await objective.save();
    }
    
    return objective;
}

module.exports = {recalculateObjective, recalculateKeyResultStatuses};