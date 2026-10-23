const User = require("../models/userModel");
const {
    canUserApproveKeyResults,
} = require("../middleware/okrPermissions");

const { generateNotifications, } = require("../controllers/notificationController");

const OBJECTIVES_PAGE = "/dashboard/okrtracker/objectives";

//Escape user-entered text before displaying it in HTML notifications
const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[character];
    });

//Send notification using Micromax's existing notification system
const sendOkrNotification = async (userIds, message) => {
    const recipients = [
        ...new Set(
            (userIds || [])
                .filter(Boolean)
                .map((id) => String(id._id || id))
        ),
    ];

    if (recipients.length === 0) return;

    try {
        await generateNotifications(
            recipients,
            message,
            ["web"],
            "okr",
            OBJECTIVES_PAGE
        );
    } catch (error) {
        console.error(
            "OKR Notifications - Failed to send notification:",
            error
        );
    }
};

//find users who can approve kr for this objective
async function getKeyResultApprovers(objective) {
    const users = await User.find();

    const approvers = [];

    for (const user of users) {
        if (await canUserApproveKeyResults(user, objective)) {
            approvers.push(user._id.toString());
        }
    }

    return approvers;
}

//Notify managers when a Key Result requires approval
const notifyAwaitingApproval = async (
    approverIds,
    keyResultTitle,
    objectiveTitle
) => {
    const message = `
        <strong>Key Result Awaiting Approval</strong><br>
        "${escapeHTML(keyResultTitle)}" under
        "${escapeHTML(objectiveTitle)}" is ready for review.
    `;

    await sendOkrNotification(approverIds, message);
};

//Notify assigned employee when their Key result is approved
const notifyKeyResultApproved = async (
    assignedUserId,
    keyResultTitle,
    objectiveTitle
) => {
    const message = `
        <strong>Key Result Approved</strong><br>
        Your Key Result "${escapeHTML(keyResultTitle)}"
        under "${escapeHTML(objectiveTitle)}"
        has been approved and marked Completed.
    `;

    await sendOkrNotification([assignedUserId], message);
};

//Notify key result assigned employee and objective owner when key result is At Risk or Overdue
const notifyKeyResultStatus = async (
    userIds,
    keyResultTitle,
    objectiveTitle,
    status
) => {
    const label = status === "at-risk" ? "At Risk" : "Overdue";

    const message = `
        <strong>Key Result ${label}</strong><br>
        "${escapeHTML(keyResultTitle)}" under
        "${escapeHTML(objectiveTitle)}" is now ${label}.
    `;

    await sendOkrNotification(userIds, message);

};

//Notify objective owner when an Objective is At Risk or Overdue
const notifyObjectiveStatus = async (
    ownerId,
    objectiveTitle,
    status
) => {
    const label = status === "at-risk" ? "At Risk" : "Overdue";

    const message = `
        <strong>Objective ${label}</strong><br>
        "${escapeHTML(objectiveTitle)}" is now ${label}.
    `;

    await sendOkrNotification([ownerId], message);

};


module.exports = { 
    getKeyResultApprovers,
    notifyAwaitingApproval, 
    notifyKeyResultApproved, 
    notifyKeyResultStatus, 
    notifyObjectiveStatus,};