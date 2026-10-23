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
const sendOkrNotification = async (canUserEditKeyResults, message) => {
    const recipients = [
        ...new Set((userIds) || [].filter(Boolean).map(String)),
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

//Notify managers when a Key Result requires approval
const notifyAwaitingApproval = async (
    managerIds,
    keyResultTitle,
    objectiveTitle
) => {
    const message = `
        <strong>Key Result Awaiting Approval</strong><br>
        "${escapeHTML(keyResultTitle)}" under
        "${escapeHTML(objectiveTitle)}" is ready for review.
    `;

    await sendOkrNotification(managerIds, message);
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

module.exports = { notifyAwaitingApproval, notifyKeyResultApproved,};