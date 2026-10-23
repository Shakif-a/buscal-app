const OkrObjective = require("../models/okrObjectiveModel");
const OkrKeyResult = require("../models/okrKeyResultModel");
const CalendarEntry = require("../models/calendarEntryModel");

const AT_RISK_TOLERANCE = 10;

// Get the current date in Sydney timezone
// I asume the base system has or will have expanded timezone support, so this is a temporary solution
function getSydneyDate() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Australia/Sydney",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const getPart = (type) =>
        parts.find((part) => part.type === type).value;

    return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

//compare calendar dates rather than exact timestamps
//(not overdue when the due date is missing or invalid so toISOString doesn't throw)
function isPastDue(dueDate, today) {
    const due = new Date(dueDate);
    if (!dueDate || isNaN(due.getTime())) return false;
    return today > due.toISOString().split("T")[0];
}

//mirror OKR completion onto the linked calendar entry so it stops being marked overdue
async function syncEntryCompletion(entryId, completed) {
    if (!entryId) return;
    try {
        const entry = await CalendarEntry.findById(entryId);
        if (!entry || entry.completionStatus === "cancelled") return;

        let status = entry.completionStatus;
        if (completed) {
            status = "completed";
        } else if (status === "completed") {
            status = "in progress";
        }

        if (status !== entry.completionStatus) {
            entry.completionStatus = status;
            await entry.save();
        }
    } catch (error) {
        console.error("Could not sync calendar completion for entry", entryId, error.message);
    }
}

async function recalculateKeyResultStatuses(objectiveId) {
    const keyResults = await OkrKeyResult.find({
        objective: objectiveId,
    });

    const now = Date.now();
    const today = getSydneyDate();

    for (const kr of keyResults) {
        //skip automatic calc for invalid due dates
        const parsedDueDate = new Date(kr.dueDate);

        if (!kr.dueDate || isNaN(parsedDueDate.getTime())) {
            continue;
        }

        const progress = kr.progress ?? 0;
        const start = new Date(kr.createdAt).getTime();
        //const end = new Date(kr.dueDate).getTime();
        //compare calendar dates rather than exact timestamps
        const dueDate = parsedDueDate.toISOString().split("T")[0];
        
        const [year, month, day] = dueDate.split("-").map(Number);

        //find the start of the following day in Sydney
        const nextDay = new Date(Date.UTC(year, month -1, day + 1));
        const nextDayString = nextDay.toISOString().split("T")[0];
        const nextDayUTC = Date.parse(`${nextDayString}T00:00:00Z`);

        const offset = new Intl.DateTimeFormat("en-US", {
            timeZone: "Australia/Sydney",
            timeZoneName: "shortOffset",
        }).formatToParts(new Date(nextDayUTC))
            .find((part) => part.type === "timeZoneName")
            .value;
        const offsetMatch = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
        const offsetMinutes = offsetMatch
            ? (offsetMatch[1] === "+" ? 1 : -1) *
                (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] || 0))
            : 0;
        const end = nextDayUTC - offsetMinutes * 60 * 1000;

        //const isOverdue = today > dueDate;
        const isOverdue = isPastDue(kr.dueDate, today);
        const duration = end - start;

        //expected progress based on kr timeline
        const expectedProgress = 
        duration <= 0
            ? now >= end ? 100 : 0
            : Math.max(
                0,
                Math.min(100, ((now - start) / duration) * 100)
            );
        //treat the old "on-track" name as "in-progress"
        let status = kr.status === "on-track" ? "in-progress" : kr.status;

        //preserve completed kr
        if (kr.approved) {
            status = "completed";
        } 
        //preserve awaiting approval only when progress is 100%
        else if (kr.status === "awaiting-approval" && progress === 100){
            status = "awaiting-approval";
        } 
        //reset invalid approval/completion status
        else if (kr.status === "awaiting-approval" || kr.status === "completed") {
            status = "in-progress";
        }
        //applying auto status to active key results
        if (status !== "completed" && status !== "awaiting-approval"){
            if (isOverdue) {
                status = "overdue";
            } else if (
                status === "in-progress" && progress < expectedProgress - AT_RISK_TOLERANCE) {
                    status = "at-risk";
            }
        }

        if (kr.status !== status) {
            kr.status = status;
            await kr.save();
            await syncEntryCompletion(kr.calendarEntry, status === "completed");
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

    const allKeyResultsApproved = 
        keyResults.length > 0 &&
        keyResults.every((kr) => kr.approved === true);

    if (progress >= 100 && allKeyResultsApproved) {
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
        const statusChanged = objective.status !== status;
        objective.progress = progress;
        objective.status = status;

        await objective.save();
        if (statusChanged) {
            await syncEntryCompletion(objective.calendarEntry, status === "completed");
        }
    }
    
    return objective;
}

module.exports = {recalculateObjective, recalculateKeyResultStatuses, syncEntryCompletion};