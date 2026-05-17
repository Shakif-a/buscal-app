const mongoose = require("mongoose");
const CalendarEntry = require("../models/calendarEntryModel");
const CalendarHistory = require("../models/calendarHistoryModel");
const User = require("../models/userModel");
const {
  generateNotifications,
} = require("../controllers/notificationController");

const busCalSettings = [
  {
    type: "assign",
    channel: ["email"],
    hichannel: ["email"],
    users: ["userAssigned"],
    content: "{userOwner} has assigned the {category} - {title} to you.",
  },
  {
    type: "update",
    channel: [],
    hichannel: [],
    users: ["userOwner", "userAssigned"],
    content: "{user} updated progress to {progress}%.",
  },
  {
    type: "complete",
    channel: ["email"],
    hichannel: ["email"],
    users: ["userOwner", "userAssigned"],
    content: "{user} completed the {category} - {title}.",
  },
  {
    type: "edit",
    channel: [],
    hichannel: [],
    users: ["userOwner", "userAssigned"],
    content: "{user} edited the {category} - {title}.",
  },
  {
    type: "reassign",
    channel: ["email"],
    hichannel: ["email"],
    users: ["userOwner", "userAssigned"],
    content: "{user} has reassigned {category} - {title} to {userAssigned}.",
  },
  {
    type: "cancel",
    channel: ["email"],
    hichannel: ["email"],
    users: ["userOwner", "userAssigned"],
    content: "{user} has cancelled the {category} - {title}.",
  },
  {
    type: "reminder",
    channel: [],
    hichannel: [],
    users: ["userAssigned"],
    content: "The {category} - {title} is due soon at {time}.",
  },
  {
    type: "reminder2",
    channel: [],
    hichannel: [],
    users: ["userAssigned"],
    content: "The {category} - {title} is due soon at {time}.",
  },
  {
    type: "overdue",
    channel: [],
    hichannel: [],
    users: ["userOwner", "userAssigned"],
    content:
      "The {category} - {title} assigned to {userAssigned} has become overdue. Created at {createdAt}, Due at {dueDate}.",
  },
  {
    type: "overdue2",
    channel: [],
    hichannel: [],
    users: ["userOwner", "userAssigned"],
    content:
      "The {category} - {title} assigned to {userAssigned} has become overdue. Please action it or change the due date. Created at {createdAt}, Due at {dueDate}.",
  },
];

const formatUKDateTime = (isoDate) => {
  if (!isoDate) return "No time set";
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

// Function to transform content strings into useable strings
function transformContentString(content) {
  return content.replace(/{(.*?)}/g, (_, match) => `\${${match}}`);
}

// Function to replace user IDs with names in a calendar entry
async function transformUserNames(calendarEntry) {
  // Create a copy of the calendarEntry
  const updatedCalendarEntry = { ...calendarEntry._doc };

  // Fetch userOwner's name
  const userOwner = await User.findById(updatedCalendarEntry.userOwner);
  updatedCalendarEntry.userOwner = userOwner
    ? `${userOwner.firstName} ${userOwner.lastName}`
    : "Unknown User";

  // Fetch userAssigned names
  const userAssignedNames = await Promise.all(
    updatedCalendarEntry.userAssigned.map(async (id) => {
      const user = await User.findById(id);
      return user ? `${user.firstName} ${user.lastName}` : "Unknown User";
    })
  );
  updatedCalendarEntry.userAssigned = userAssignedNames;

  // Fetch supervisor of the first user in userAssigned
  if (updatedCalendarEntry.userAssigned.length > 0) {
    const firstUser = await User.findById(calendarEntry.userAssigned[0]);
    updatedCalendarEntry.supervisor = firstUser?.supervisor || null;
  } else {
    updatedCalendarEntry.supervisor = null; // No supervisor if userAssigned is empty
  }

  return updatedCalendarEntry;
}

function makeNotificationInput(
  calendarEntry,
  user,
  userOwner,
  userAssigned,
  supervisor,
  setting,
  link
) {
  // Helper function to resolve placeholder variables in the content string
  function resolveContent(template) {
    return template.replace(/\$\{(.*?)\}/g, (_, key) => {
      switch (key) {
        case "user":
          return user;
        case "userOwner":
          return userOwner;
        case "userAssigned":
          return Array.isArray(userAssigned)
            ? userAssigned.join(", ")
            : userAssigned;
        case "supervisor":
          return supervisor;
        case "time":
          const timeField = ["meeting", "general", "event"].includes(
            calendarEntry.category
          )
            ? "startTime"
            : "endTime";
          return formatUKDateTime(calendarEntry[timeField]);
        case "createdAt":
          return formatUKDateTime(calendarEntry.createdAt);
        case "dueDate":
          const timeField2 = ["meeting", "general", "event"].includes(
            calendarEntry.category
          )
            ? "startTime"
            : "endTime";
          return formatUKDateTime(calendarEntry[timeField2]);
        default:
          return calendarEntry[key] !== undefined
            ? calendarEntry[key]
            : `{${key}}`; // Preserve unmatched placeholders
      }
    });
  }

  // Prepare the `users` array from `setting.users`
  const users = new Set();
  if (setting.users.includes("userOwner") && calendarEntry.userOwner) {
    users.add(calendarEntry.userOwner.toString());
  }
  if (
    setting.users.includes("userAssigned") &&
    Array.isArray(calendarEntry.userAssigned)
  ) {
    calendarEntry.userAssigned.forEach((id) => users.add(id.toString()));
  }
  if (setting.users.includes("supervisor") && supervisor) {
    users.add(supervisor.toString());
  }

  // Prepare the `channels` array based on priority
  const channels =
    calendarEntry.priority === "high" ? setting.hichannel : setting.channel;

  // Resolve the `content` string using placeholders and variables
  const content = resolveContent(setting.content);

  // Return the notification input object
  return {
    users: Array.from(users),
    channels: channels,
    content: content,
    category: "calendar",
    link: link,
  };
}

async function runBusCalService(
  type,
  calendarEntryId,
  user,
  additionalObject = {}
) {
  try {
    // Validate type
    const setting = busCalSettings.find((setting) => setting.type === type);
    if (!setting) {
      throw new Error(`Invalid type: ${type}`);
    }

    // Retrieve CalendarEntry document
    const calendarEntry = await CalendarEntry.findById(calendarEntryId);
    if (!calendarEntry) {
      throw new Error(`CalendarEntry with ID ${calendarEntryId} not found.`);
    }

    // Retrieve corresponding CalendarHistory document
    const calendarHistory = await CalendarHistory.findOne({
      ref: calendarEntryId,
    });
    if (!calendarHistory) {
      throw new Error(
        `CalendarHistory for CalendarEntry ID ${calendarEntryId} not found.`
      );
    }

    // Transform content string without modifying the original
    const transformedContent = transformContentString(setting.content);

    // Replace user IDs with names, including supervisor
    const updatedCalendarEntry = await transformUserNames(calendarEntry);

    // Use completionStatus from additionalObject if provided, otherwise use from DB
    const effectiveCompletionStatus =
      additionalObject.completionStatus || calendarEntry.completionStatus;

    // Create the link based on effective completion status
    const baseLink =
      effectiveCompletionStatus === "completed" ||
      effectiveCompletionStatus === "cancelled"
        ? "/dashboard/business-calendar/history"
        : "/dashboard/business-calendar";
    const encodedTitle = encodeURIComponent(calendarEntry.title);
    const linkWithSearch = `${baseLink}?search=${encodedTitle}`;

    // Call the function
    const notificationInput = makeNotificationInput(
      calendarEntry,
      user,
      updatedCalendarEntry.userOwner,
      updatedCalendarEntry.userAssigned,
      updatedCalendarEntry.supervisor,
      { ...setting, content: transformedContent },
      linkWithSearch
    );

    // Use generateNotifications to send notifications
    const { users, content, channels, category, link } = notificationInput;
    await generateNotifications(
      users,
      content,
      channels,
      category,
      linkWithSearch,
      additionalObject
    );

    // Append notification data to calendarHistory.notifications
    users.forEach((userId) => {
      calendarHistory.notifications.push({
        user: mongoose.Types.ObjectId(userId), // Ensure ObjectId type
        notes: content,
      });
    });

    // Save updated CalendarHistory
    await calendarHistory.save();

    console.log("Successfully updated CalendarHistory:", calendarHistory);

    // Additional logic can be implemented here using transformed content and updated entries
  } catch (error) {
    console.error("Error in runBusCalService:", error.message);
  }
}

module.exports = { runBusCalService };
