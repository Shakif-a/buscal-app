const asyncHandler = require("express-async-handler");
const fs = require("fs");
const path = require("path");
const { getUploadedFilePath } = require("../config/uploadPaths");
const CalendarEntry = require("../models/calendarEntryModel");
const CalendarHistory = require("../models/calendarHistoryModel");
const File = require("../models/filesModel");
const User = require("../models/userModel");
const JobDescription = require("../models/jobDescriptionsModel");
const RRule = require("rrule").RRule;
const handleRecurringEntries = require("../scheduling/handleRecurringEntries");
const { runBusCalService } = require("../services/busCalendarServices");
const { add } = require("lodash");

//--------------------------------------------------------------------//
//---------------------------HELPER----------------------------------//
//------------------------------------------------------------------//

const generateReminderOptions = (startTime, endTime, whenAlarm) => {
  // Parse the input dates
  const startDate = startTime ? new Date(startTime) : null;
  const endDate = endTime ? new Date(endTime) : null;
  const alarmDate = whenAlarm ? new Date(whenAlarm) : null;
  // Validate the input dates
  if (!alarmDate || (!startDate && !endDate)) {
    return null;
  }

  // Determine the calcDate
  const calcDate = startDate ? startDate : endDate;

  // Calculate the difference in milliseconds
  const diffInMillis = calcDate - alarmDate;

  // Convert the difference to hours
  const diffInHours = diffInMillis / (1000 * 60 * 60);

  // Determine the appropriate output string
  if (diffInHours >= 0.25 && diffInHours <= 0.75) {
    return "30 mins before";
  } else if (diffInHours >= 23 && diffInHours <= 25) {
    return "1 day before";
  } else if (diffInHours >= 46 && diffInHours <= 50) {
    return "2 days before";
  } else if (diffInHours >= 144 && diffInHours <= 192) {
    return "1 week before";
  }

  // Return null for invalid differences
  return null;
};

const isSameTimes = (date1, date2) => {
  // Convert inputs to Date objects
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  // Check if the dates are valid
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    throw new Error("Invalid date format");
  }

  // Calculate the difference in milliseconds
  const difference = Math.abs(d1.getTime() - d2.getTime());

  // 5 minutes in milliseconds
  const fiveMinutesInMillis = 5 * 60 * 1000;

  // Return true if the difference is less than 5 minutes, otherwise false
  return difference < fiveMinutesInMillis;
};

const makeRecurrenceString = (recurrence, dateStart) => {
  // Validate inputs
  if (!recurrence || !recurrence.freq || !dateStart) {
    console.error("Invalid inputs for makeRecurrenceString:", {
      recurrence,
      dateStart,
    });
    return null;
  }

  // Map the frequency string to the corresponding RRule frequency
  let freq;
  let interval = recurrence.interval || 1; // Default interval is 1
  switch (recurrence.freq.toLowerCase()) {
    case "monthly":
      freq = RRule.MONTHLY;
      break;
    case "quarterly":
      freq = RRule.MONTHLY;
      interval = 3; // Quarterly is monthly with interval 3
      break;
    case "yearly":
      freq = RRule.YEARLY;
      break;
    case "weekly":
      freq = RRule.WEEKLY;
      break;
    case "daily":
      freq = RRule.DAILY;
      break;
    default:
      console.error("Invalid frequency:", recurrence.freq);
      return null; // Return null if no match
  }

  let recurrenceString = null;
  if (freq !== null) {
    // Calculate the default until date 100 years in the future
    const defaultUntilDate = new Date();
    defaultUntilDate.setFullYear(defaultUntilDate.getFullYear() + 100);

    // Extract day of the month from dateStart
    const startDateDay = dateStart.getDate();

    // Find better fix later, now anything after 28 is end of month.
    let bymonthday = null;
    if (freq === RRule.MONTHLY) {
      // Special handling for end-of-month dates (applies to both monthly and quarterly)
      if (startDateDay > 28) {
        bymonthday = -1; // Last day of the month
      }
    }

    try {
      const recRule = new RRule({
        freq,
        interval: interval, // Use the interval determined above (3 for quarterly, or provided interval)
        byweekday: recurrence.byweekday,
        bymonthday: bymonthday, // Use -1 for end of month when needed
        bymonth: recurrence.bymonth,
        bysetpos: recurrence.bysetpos,
        dtstart: dateStart,
        until: recurrence.until ? new Date(recurrence.until) : defaultUntilDate,
      });
      recurrenceString = recRule.toString();
    } catch (error) {
      console.error("Error creating RRule:", error);
      return null;
    }
  }
  return recurrenceString;
};

const recStringToObject = (recurrenceString) => {
  // Validate input
  if (!recurrenceString) {
    console.error("Invalid input for recStringToObject:", recurrenceString);
    return null;
  }

  let recRule;
  try {
    // Create the RRule object from the string
    recRule = RRule.fromString(recurrenceString);
  } catch (error) {
    console.error("Error parsing recurrence string:", error);
    return null;
  }

  // Extract values from the RRule object
  // Determine frequency string - check for quarterly (MONTHLY with interval 3) before monthly
  let freqString = null;
  if (recRule.options.freq === RRule.YEARLY) {
    freqString = "yearly";
  } else if (recRule.options.freq === RRule.MONTHLY) {
    // Check if it's quarterly (monthly with interval 3) or regular monthly
    if (recRule.options.interval === 3) {
      freqString = "quarterly";
    } else {
      freqString = "monthly";
    }
  } else if (recRule.options.freq === RRule.WEEKLY) {
    freqString = "weekly";
  } else if (recRule.options.freq === RRule.DAILY) {
    freqString = "daily";
  }

  const recurrence = {
    freq: freqString,
    interval: recRule.options.interval,
    byweekday: recRule.options.byweekday,
    bymonthday: recRule.options.bymonthday,
    bymonth: recRule.options.bymonth,
    bysetpos: recRule.options.bysetpos,
    dtstart: recRule.options.dtstart,
    until: recRule.options.until,
  };

  // Generate human-readable text
  try {
    const displayRule = recRule.toText();
    recurrence.displayRule = displayRule;
  } catch (error) {
    console.error("Error generating human-readable text:", error);
    return null;
  }

  return recurrence;
};

const processRecurrenceEntries = (entries) => {
  return entries.map((entry) => {
    let updatedEntry = { ...entry._doc }; // Create a shallow copy of the entry object
    if (entry.recurrence) {
      updatedEntry.recurrence = recStringToObject(entry.recurrence);
    }
    return updatedEntry;
  });
};

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS----------------------------------
//-----------------------------------------------------------------------------------
// @desc    Get all calendar entries
// @route   GET /api/calendar/entries
// @access  Private
const getAllEntry = asyncHandler(async (req, res) => {
  const allEntries = await CalendarEntry.find({});
  const updatedEntries = processRecurrenceEntries(allEntries);
  res.status(200).json(updatedEntries);
});

// @desc Get a calendar entry by ID
// @route GET /api/calendar/entries/:entryId
// @access Private
const getEntryById = asyncHandler(async (req, res) => {
  const entryId = req.params.entryId;

  try {
    const entry = await CalendarEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }
    const updatedEntry = processRecurrenceEntries([entry])[0]; // Process single entry
    res.status(200).json(updatedEntry);
  } catch (error) {
    console.error("Error retrieving entry:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// @desc    Get all calendar entries for a specific user
// @route   GET /api/calendar/entries/user/:id
// @access  Private
const getUserEntries = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  // Search for entries where the user is either the owner or assigned user
  const userEntries = await CalendarEntry.find({
    $or: [{ userOwner: userId }, { userAssigned: userId }],
  });

  const updatedUserEntries = processRecurrenceEntries(userEntries);
  res.status(200).json(updatedUserEntries);
});

// @desc    Get all calendar entries for a supervisor's reporting users
// @route   GET /api/calendar/entries/supervisor/:id
// @access  Private
const getSupervisorEntries = asyncHandler(async (req, res) => {
  const supervisorId = req.params.id;
  try {
    // Find the job descriptions of the supervisor
    const supervisorJobDescriptions = await JobDescription.find({
      usersAssigned: supervisorId,
    });

    if (!supervisorJobDescriptions || supervisorJobDescriptions.length === 0) {
      console.log("Supervisor not found");
      return res.status(404).json({ message: "Supervisor not found" });
    }

    // Collect all unique reporting user IDs from the supervisor's job descriptions
    const reportingUsersSet = new Set();

    supervisorJobDescriptions.forEach((jobDesc) => {
      jobDesc.reportingUsers.forEach((user) => {
        if (user.toString() !== supervisorId) {
          reportingUsersSet.add(user.toString());
        }
      });
    });

    const reportingUsers = Array.from(reportingUsersSet);
    let reportingUserIds = [];

    // For each job description ID in reportingUsers, find the users assigned to it
    for (const jobDescId of reportingUsers) {
      const jobDescription = await JobDescription.findById(jobDescId);
      if (jobDescription && jobDescription.usersAssigned.length > 0) {
        jobDescription.usersAssigned.forEach((user) => {
          if (user.toString() !== supervisorId) {
            reportingUserIds.push(user.toString());
          }
        });
      }
    }

    // Ensure reportingUserIds are unique
    reportingUserIds = [...new Set(reportingUserIds)];
    let allEntries = [];

    // For each user ID in reportingUserIds, find their calendar entries
    for (const userId of reportingUserIds) {
      const userEntries = await CalendarEntry.find({ userAssigned: userId });
      allEntries = allEntries.concat(userEntries);
    }

    const updatedEntries = processRecurrenceEntries(allEntries);
    res.status(200).json(updatedEntries);
  } catch (error) {
    console.error("Error retrieving supervisor entries:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// @desc    Get all calendar histories
// @route   GET /api/calendar/histories
// @access  Private
const getAllHistory = asyncHandler(async (req, res) => {
  try {
    const allHistory = await CalendarHistory.find({});
    res.status(200).json(allHistory);
  } catch (error) {
    console.error("Error fetching calendar history:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// @desc    Get a calendar history by ID
// @route   GET /api/calendar/histories/:historyId
// @access  Private
const getHistoryById = asyncHandler(async (req, res) => {
  const historyId = req.params.historyId;

  try {
    const history = await CalendarHistory.findOne({ ref: historyId });
    if (!history) {
      return res.status(404).json({ message: "History not found" });
    }
    res.status(200).json(history);
  } catch (error) {
    console.error("Error retrieving history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATERS----------------------------------
//-----------------------------------------------------------------------------------
// @desc    Update a calendar entry
// @route   PUT /api/calendar/:entryId
// @access  Private
const updateEntry = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    startTime,
    endTime,
    completionStatus,
    progress,
    whenAlarm,
    recurrence,
    priority,
    notes,
    category,
    file,
  } = req.body;

  console.log("Update entry received: ", req.body);

  const entryId = req.params.entryId; // Get the object ID from the request parameters
  const userId = req.user?._id;
  const userFirstName = req.user?.firstName;
  const userLastName = req.user?.lastName;
  const userFullName =
    userFirstName && userLastName
      ? `${userFirstName} ${userLastName}`
      : userFirstName || "Unknown User";

  if (!userId || !userFirstName) {
    return res.status(400).json({ error: "User information is missing." });
  }

  try {
    // Find the calendar entry by ID
    let entry = await CalendarEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Calendar entry not found." });
    }

    // Find the corresponding history document
    const history = await CalendarHistory.findOne({ ref: entry._id });
    if (!history) {
      return res.status(404).json({ error: "Calendar history not found." });
    }

    // Track fields that are changed
    const changedFields = [];

    let reminder = null;
    let timeDate = null;

    if (endTime || startTime || entry.endTime || entry.startTime) {
      // Determine whether to use startTimeDate or endTimeDate
      const entryCategory = category || entry.category;

      if (["general", "event", "meeting"].includes(entryCategory)) {
        timeDate = new Date(startTime || entry.startTime);
      } else {
        timeDate = new Date(
          endTime || entry.endTime || startTime || entry.startTime,
        );
      }

      // Validate timeDate
      if (isNaN(timeDate.getTime())) {
        return res.status(400).json({ error: "Invalid time provided." });
      }

      // Calculate reminder date based on whenAlarm value
      switch (whenAlarm) {
        case "30 mins before":
          reminder = new Date(timeDate.getTime() - 30 * 60 * 1000);
          break;
        case "1 day before":
          reminder = new Date(timeDate.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "2 days before":
          reminder = new Date(timeDate.getTime() - 2 * 24 * 60 * 60 * 1000);
          break;
        case "1 week before":
          reminder = new Date(timeDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          reminder = null;
      }
    }
    let updatedRecurrence;
    if (recurrence) {
      updatedRecurrence = makeRecurrenceString(recurrence, timeDate);
    }

    const now = new Date();
    let isUpdateChange = false;

    // Check and update each field if provided in the request body
    if (title && title !== entry.title) {
      entry.title = title;
      changedFields.push("title");
    }
    if (description && description !== entry.description) {
      entry.description = description;
      changedFields.push("description");
    }
    if (
      startTime &&
      (entry.startTime === undefined ||
        !isSameTimes(startTime, entry.startTime))
    ) {
      entry.startTime = startTime;
      changedFields.push("start time");

      if (
        ["general", "event", "meeting"].includes(entry.category) &&
        new Date(startTime) > now
      ) {
        if (entry.completionStatus === "overdue") {
          const completionNote = `Completion status changed from ${entry.completionStatus} to in progress due to start time update.`;
          entry.completionStatus = "in progress";
          history.completionChanges.push({
            user: userId,
            notes: completionNote,
          });
          changedFields.push("completionStatus");
        }
      }
    }
    if (endTime && !isSameTimes(endTime, entry.endTime)) {
      entry.endTime = endTime;
      changedFields.push("end time");

      if (
        !["general", "event", "meeting"].includes(entry.category) &&
        new Date(endTime) > now
      ) {
        if (entry.completionStatus === "overdue") {
          const completionNote = `Completion status changed from ${entry.completionStatus} to in progress due to end time update.`;
          entry.completionStatus = "in progress";
          history.completionChanges.push({
            user: userId,
            notes: completionNote,
          });
          changedFields.push("completionStatus");
        }
      }
    }
    if (whenAlarm && reminder !== entry.whenAlarm) {
      entry.whenAlarm = reminder;
      changedFields.push("reminder time");
    }
    if (completionStatus && completionStatus !== entry.completionStatus) {
      const completionNote = `Completion status changed from ${entry.completionStatus} to ${completionStatus}`;
      entry.completionStatus = completionStatus;
      history.completionChanges.push({
        user: userId,
        notes: completionNote,
      });
      changedFields.push("completionStatus");
      // Check if the new status is "completed"
      if (completionStatus === "completed") {
        // Call runBusCalService for the "complete" type
        // initialise empty object
        let additionalObject = {};
        additionalObject.completionStatus = "completed";
        if (file && Array.isArray(file)) {
          console.log("Files provided for completion:", file);
          // Add file information to the additionalObject
          additionalObject.file = file;
        }
        if (notes && notes !== entry.notes) {
          console.log("Notes provided for completion:", notes);
          // Add notes to the additionalObject
          additionalObject.notes = notes;
        }
        await runBusCalService(
          "complete",
          entryId,
          userFullName,
          additionalObject,
        );
      }
    }
    if (typeof progress === "number" && progress !== entry.progress) {
      entry.progress = progress;
      const progressNote = notes
        ? `${userFullName} updated progress to ${progress}%. ${notes}`
        : `${userFullName} updated progress to ${progress}%.`;
      history.completionChanges.push({
        user: userId,
        notes: progressNote,
      });
      isUpdateChange = true;
    }
    if (recurrence && updatedRecurrence !== entry.recurrence) {
      console.log(
        "Recurrence is changed from ",
        entry.recurrence,
        "to ",
        updatedRecurrence,
      );
      entry.recurrence = updatedRecurrence;
      changedFields.push("recurrence");
    }
    if (priority && priority !== entry.priority) {
      entry.priority = priority;
      changedFields.push("priority");
    }
    if (notes && notes !== entry.notes) {
      entry.notes = notes;
      if (!completionStatus || completionStatus === "") {
        changedFields.push("notes");
      }
    }
    if (category && category !== entry.category) {
      entry.category = category;
      changedFields.push("category");
      if (["action", "businessdeadline", "task"].includes(category)) {
        entry.startTime = null;
        if (category === "task") {
          entry.recurrence = null;
        }
      }
    }
    if (file && Array.isArray(file)) {
      entry.file = entry.file || [];
      const newFiles = file.filter((f) => !entry.file.includes(f));
      if (newFiles.length > 0) {
        entry.file.push(...newFiles);
        changedFields.push("file");
      }
    }

    // Update edits in history if any fields are changed
    if (changedFields.length > 0) {
      const isProgressChanged = changedFields.includes("progress");
      const editFields = changedFields.filter(
        (field) => field !== "completionStatus",
      );
      let filenames = [];
      let fileNotes = "";

      if (file && Array.isArray(file) && file.length > 0) {
        const fileDocs = await File.find({ _id: { $in: file } });
        filenames = fileDocs.map((doc) => doc.filename);
        fileNotes = filenames.length
          ? `${userFirstName} uploaded a file called ${filenames.join(", ")}.`
          : "";
      }

      if (editFields.length > 0) {
        const editNotes = `${userFirstName} edited ${editFields.join(", ")}. `;
        history.edits.push({
          user: userId,
          notes: editNotes + fileNotes,
        });
      } else if (fileNotes) {
        history.edits.push({
          user: userId,
          notes: fileNotes,
        });
      }

      if (!isProgressChanged && !completionStatus) {
        await runBusCalService("edit", entryId, userFullName);
      }
    }
    await handleRecurringEntries();
    await entry.save();
    await history.save();

    if (isUpdateChange && progress !== 100) {
      await runBusCalService("update", entryId, userFullName);
    }
    res
      .status(200)
      .json({ message: "Calendar entry updated successfully.", entry });
  } catch (error) {
    console.error("Error updating calendar entry:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// @desc    Reassign a calendar entry
// @route   PUT /api/calendar/:entryId/reassign
// @access  Private
const reassignEntry = asyncHandler(async (req, res) => {
  const { userAssigned, notes, file } = req.body;
  const entryId = req.params.entryId; // Get the object ID from the request parameters
  const userId = req.user?._id;
  const userFirstName = req.user?.firstName;
  const userLastName = req.user?.lastName;
  const userFullName =
    userFirstName && userLastName
      ? `${userFirstName} ${userLastName}`
      : userFirstName || "Unknown User";

  console.log("Reassignment request: ", req.body);
  try {
    // Find the calendar entry by ID
    let entry = await CalendarEntry.findById(entryId);
    if (!entry) {
      return res.status(404).json({ error: "Calendar entry not found." });
    }

    // Find the corresponding history document
    const history = await CalendarHistory.findOne({ ref: entry._id });
    if (!history) {
      return res.status(404).json({ error: "Calendar history not found." });
    }

    // Find users by their emails provided in userAssigned
    if (
      userAssigned &&
      Array.isArray(userAssigned) &&
      userAssigned.length > 0
    ) {
      const users = await User.find({ email: { $in: userAssigned } });
      if (users.length !== userAssigned.length) {
        throw new Error(
          "One or more users with the provided email addresses not found",
        );
      }

      // Map user emails to their corresponding IDs
      const userIds = users.map((user) => user._id);

      // Compare userAssigned with current entry.userAssigned
      const isSameUsers =
        JSON.stringify(entry.userAssigned) === JSON.stringify(userIds);

      if (!isSameUsers) {
        // Update calendar entry's userAssigned
        entry.userAssigned = userIds;

        // Build reassignment notes
        let reassignNotes = `Entry reassigned to`;
        userAssigned.forEach((email, index) => {
          const user = users.find((u) => u.email === email);
          if (user) {
            reassignNotes += ` ${user.firstName} ${user.lastName}`;
            if (index < userAssigned.length - 1) {
              reassignNotes += `,`;
            }
          }
        });

        let finalNotes = reassignNotes;
        if (notes) {
          finalNotes += `. ${notes}`;
          entry.notes = notes;
        }
        if (file && Array.isArray(file)) {
          entry.file = entry.file || [];
          const newFiles = file.filter((f) => !entry.file.includes(f));
          if (newFiles.length > 0) {
            entry.file.push(...newFiles);
          }
        }

        // Push reassignment to history
        history.reassignments.push({
          user: userId,
          notes: finalNotes,
        });

        // Save entry and history
        await entry.save();
        await history.save();
        // Prepare additional data for calendar integration
        let additionalObject = {};

        // Add essential calendar data
        additionalObject.title = entry.title;
        additionalObject.endTime = entry.endTime;

        // Add optional fields if they exist
        if (entry.description) {
          additionalObject.description = entry.description;
        }

        if (entry.startTime) {
          additionalObject.startTime = entry.startTime;
        }

        // Add updated notes and files from the reassignment
        if (notes) {
          additionalObject.notes = notes;
        }

        if (file && Array.isArray(file) && file.length > 0) {
          additionalObject.file = file;
        }

        await runBusCalService(
          "reassign",
          entryId,
          userFullName,
          additionalObject,
        );
      }
    }

    // Return success response
    res
      .status(200)
      .json({ message: "Calendar entry reassigned successfully.", entry });
  } catch (error) {
    console.error("Error reassigning calendar entry:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// @desc    Update a recurring calendar entry
// @route   PUT /api/calendar/entries/recur/:entryId
// @access  Private
const updateRecurringEntries = asyncHandler(async (req, res) => {
  const entryId = req.params.entryId;
  const {
    type,
    userAssigned,
    notes,
    file,
    title,
    category,
    priority,
    description,
    startTime,
    endTime,
    recurrence,
    whenAlarm,
  } = req.body;
  const userId = req.user?._id;
  const userFirstName = req.user?.firstName;
  const userLastName = req.user?.lastName;
  const userFullName =
    userFirstName && userLastName
      ? `${userFirstName} ${userLastName}`
      : userFirstName || "Unknown User";

  console.log("Update recurring entries received: ", req.body);

  try {
    // Find the calendar entry by ID
    const calendarEntry = await CalendarEntry.findById(entryId);

    if (!calendarEntry) {
      return res.status(404).json({ message: "Calendar entry not found" });
    }

    // Determine if the entry is the original or a copy
    let originalEntryId;
    if (calendarEntry.originalEntry) {
      // If it is a copy, find the original entry ID
      originalEntryId = calendarEntry.originalEntry;
    } else {
      // If it is the original, use its ID
      originalEntryId = calendarEntry._id;
    }

    //--------- HANDLERS ---------//
    const handleCancellations = async (
      entryId,
      originalEntryId,
      notes,
      file,
      userId,
      userFullName,
    ) => {
      try {
        // Fetch filenames from Files collection if file array is provided
        let filenames = [];
        if (file && Array.isArray(file) && file.length > 0) {
          const fileDocs = await File.find({ _id: { $in: file } });
          filenames = fileDocs.map((doc) => doc.filename);
        }

        const fileNotes = filenames.length
          ? `${userFullName} uploaded a file called ${filenames.join(", ")}.`
          : "";

        // Update the original entry
        const originalEntry = await CalendarEntry.findById(originalEntryId);
        let historyNotes;
        if (notes) {
          originalEntry.notes = notes;
          historyNotes = `The user cancelled this entry. ${notes}`;
        } else {
          historyNotes = "The user cancelled this entry.";
        }
        if (file && Array.isArray(file)) {
          if (!Array.isArray(originalEntry.file)) {
            originalEntry.file = [];
          }
          originalEntry.file.push(...file);
        }
        await CalendarHistory.findOneAndUpdate(
          { ref: originalEntryId },
          {
            $push: {
              completionChanges: {
                user: userId,
                notes: historyNotes,
              },
              ...(filenames.length && {
                edits: {
                  user: userId,
                  notes: fileNotes,
                },
              }),
            },
          },
        );
        originalEntry.completionStatus = "cancelled";
        await originalEntry.save();

        // If the entry being modified is not the original, update it as well
        if (entryId.toString() !== originalEntryId.toString()) {
          const calendarEntry = await CalendarEntry.findById(entryId);
          if (notes) {
            calendarEntry.notes = notes;
          }
          if (file && Array.isArray(file)) {
            if (!Array.isArray(calendarEntry.file)) {
              calendarEntry.file = [];
            }
            calendarEntry.file.push(...file);
          }
          await CalendarHistory.findOneAndUpdate(
            { ref: entryId },
            {
              $push: {
                completionChanges: {
                  user: userId,
                  notes: historyNotes,
                },
                ...(filenames.length && {
                  edits: {
                    user: userId,
                    notes: fileNotes,
                  },
                }),
              },
            },
          );
          calendarEntry.completionStatus = "cancelled";
          await calendarEntry.save();
        }

        // Find entries to delete
        const entriesToDelete = await CalendarEntry.find({
          originalEntry: originalEntryId,
          _id: { $ne: entryId },
          completionStatus: { $nin: ["completed", "cancelled"] },
        });

        // Extract the _id values of the entries to delete
        const entryIdsToDelete = entriesToDelete.map((entry) => entry._id);

        // Delete the entries
        if (entryIdsToDelete.length > 0) {
          await CalendarEntry.deleteMany({ _id: { $in: entryIdsToDelete } });
          await CalendarHistory.deleteMany({ ref: { $in: entryIdsToDelete } });
        }

        return { success: true };
      } catch (error) {
        console.error("Error updating entry:", error);
        return { success: false, error };
      }
    };
    const handleReassignments = async (
      entryId,
      originalEntryId,
      notes,
      file,
      userAssigned,
      userId,
      userFullName,
    ) => {
      try {
        // Find users by their emails provided in userAssigned
        if (
          userAssigned &&
          Array.isArray(userAssigned) &&
          userAssigned.length > 0
        ) {
          const users = await User.find({ email: { $in: userAssigned } });
          if (users.length !== userAssigned.length) {
            throw new Error(
              "One or more users with the provided email addresses not found",
            );
          }

          // Map user emails to their corresponding IDs
          const userIds = users.map((user) => user._id);

          // Fetch filenames from Files collection if file array is provided
          let filenames = [];
          if (file && Array.isArray(file) && file.length > 0) {
            const fileDocs = await File.find({ _id: { $in: file } });
            filenames = fileDocs.map((doc) => doc.filename);
          }

          const fileNotes = filenames.length
            ? `${userFullName} uploaded a file called ${filenames.join(", ")}.`
            : "";

          // Update the original entry
          const originalEntry = await CalendarEntry.findById(originalEntryId);
          let reassignNotes = `Entry reassigned to`;
          userAssigned.forEach((email, index) => {
            const user = users.find((u) => u.email === email);
            if (user) {
              reassignNotes += ` ${userFullName}`;
              if (index < userAssigned.length - 1) {
                reassignNotes += `,`;
              }
            }
          });

          let finalNotes = reassignNotes;
          if (notes) {
            finalNotes += `. ${notes}`;
            originalEntry.notes = notes;
          }

          if (file && Array.isArray(file)) {
            if (!Array.isArray(originalEntry.file)) {
              originalEntry.file = [];
            }
            originalEntry.file.push(...file);
          }
          await CalendarHistory.findOneAndUpdate(
            { ref: originalEntryId },
            {
              $push: {
                reassignments: {
                  user: userId,
                  notes: finalNotes,
                },
                ...(filenames.length && {
                  edits: {
                    user: userId,
                    notes: fileNotes,
                  },
                }),
              },
            },
          );
          originalEntry.userAssigned = userIds;
          await originalEntry.save();

          // If the entry being modified is not the original, update it as well
          if (entryId.toString() !== originalEntryId.toString()) {
            const calendarEntry = await CalendarEntry.findById(entryId);
            if (notes) {
              calendarEntry.notes = notes;
            }
            if (file && Array.isArray(file)) {
              if (!Array.isArray(calendarEntry.file)) {
                calendarEntry.file = [];
              }
              calendarEntry.file.push(...file);
            }
            await CalendarHistory.findOneAndUpdate(
              { ref: entryId },
              {
                $push: {
                  reassignments: {
                    user: userId,
                    notes: finalNotes,
                  },
                  ...(filenames.length && {
                    edits: {
                      user: userId,
                      notes: fileNotes,
                    },
                  }),
                },
              },
            );
            calendarEntry.userAssigned = userIds;
            await calendarEntry.save();
          }

          // Update userAssigned for all other active copies
          await CalendarEntry.updateMany(
            {
              originalEntry: originalEntryId,
              _id: { $ne: entryId },
              completionStatus: { $nin: ["completed", "cancelled"] },
            },
            { $set: { userAssigned: userIds } },
          );

          return { success: true };
        } else {
          throw new Error("No users provided for reassignment");
        }
      } catch (error) {
        console.error("Error reassigning entry:", error);
        return { success: false, error };
      }
    };
    const handleEdits = async (
      originalEntryId,
      entryId,
      title,
      category,
      priority,
      description,
      file,
      userId,
      userFullName,
      startTime,
      endTime,
      recurrence,
      whenAlarm,
    ) => {
      const updateRecurrence = async (
        currentEntry,
        originalEntryId,
        startTime,
        endTime,
        recurrence,
        whenAlarm,
        category,
      ) => {
        console.log("\n Calling update recurrence");

        // Check if the currentEntry is "completed" or "cancelled"
        if (
          ["completed", "cancelled"].includes(currentEntry.completionStatus)
        ) {
          console.log("Entry is completed or cancelled. No updates made.");
          return;
        }

        // Nested function to determine the alarm date
        const determineAlarm = (whenAlarm, timeDate) => {
          let reminder;
          console.log("Determine alarm is called");
          console.log("whenAlarm: " + whenAlarm + " timeDate: " + timeDate);
          switch (whenAlarm) {
            case "30 mins before":
              reminder = new Date(timeDate.getTime() - 30 * 60 * 1000);
              break;
            case "1 day before":
              reminder = new Date(timeDate.getTime() - 24 * 60 * 60 * 1000);
              break;
            case "2 days before":
              reminder = new Date(timeDate.getTime() - 2 * 24 * 60 * 60 * 1000);
              break;
            case "1 week before":
              reminder = new Date(timeDate.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            default:
              reminder = null;
          }
          return reminder;
        };

        // Get which timeDate to use
        const entryCategory = category || currentEntry.category;
        let timeDate;

        if (["general", "event", "meeting"].includes(entryCategory)) {
          timeDate = new Date(startTime || currentEntry.startTime);
        } else {
          timeDate = new Date(
            endTime ||
              currentEntry.endTime ||
              startTime ||
              currentEntry.startTime,
          );
        }

        // Calculate the reminder date if whenAlarm exists
        let reminder = null;
        if (whenAlarm || currentEntry.whenAlarm) {
          reminder = determineAlarm(
            whenAlarm ||
              generateReminderOptions(
                currentEntry.startTime,
                currentEntry.endTime,
                currentEntry.whenAlarm,
              ),
            timeDate,
          );
        }

        // Update startTime, endTime, and whenAlarm for currentEntry
        const previousStartTime = currentEntry.startTime
          ? new Date(currentEntry.startTime)
          : null;
        const previousEndTime = new Date(currentEntry.endTime);

        if (startTime) {
          currentEntry.startTime = new Date(startTime);
        }
        if (endTime) {
          currentEntry.endTime = new Date(endTime);
        }

        const startTimeDiff = previousStartTime
          ? new Date(currentEntry.startTime) - previousStartTime
          : null;
        const endTimeDiff = new Date(currentEntry.endTime) - previousEndTime;

        // Set new recurrence string
        const currentRecurrenceObject =
          recurrence || recStringToObject(currentEntry.recurrence);
        const newRecurrenceString = makeRecurrenceString(
          currentRecurrenceObject,
          timeDate,
        );

        // Update original entry with calculated differences
        let originalEntry = await CalendarEntry.findById(originalEntryId);
        if (originalEntryId !== currentEntry._id) {
          const originalCategory = category || originalEntry.category;
          let timeDateOrig;

          if (startTimeDiff !== null) {
            originalEntry.startTime = new Date(
              new Date(originalEntry.startTime).getTime() + startTimeDiff,
            );
          }

          originalEntry.endTime = new Date(
            new Date(originalEntry.endTime).getTime() + endTimeDiff,
          );

          if (["general", "event", "meeting"].includes(originalCategory)) {
            timeDateOrig = new Date(originalEntry.startTime);
          } else {
            timeDateOrig = new Date(
              originalEntry.endTime || startTime || originalEntry.startTime,
            );
          }

          if (whenAlarm || originalEntry.whenAlarm) {
            // Determine whenAlarm for originalEntry based on new timeDateOrig
            const originalReminder = determineAlarm(
              whenAlarm ||
                generateReminderOptions(
                  originalEntry.startTime,
                  originalEntry.endTime,
                  originalEntry.whenAlarm,
                ),
              timeDateOrig,
            );

            originalEntry.whenAlarm = originalReminder;
          }

          const newOriginalRecurrenceString = makeRecurrenceString(
            currentRecurrenceObject,
            timeDateOrig,
          );

          originalEntry.recurrence = newOriginalRecurrenceString;
          await originalEntry.save();
        }

        if (reminder !== null) {
          currentEntry.whenAlarm = reminder;
        }

        currentEntry.recurrence = newRecurrenceString;
        await currentEntry.save();

        // Delete all copies of originalEntry that are not "completed" or "cancelled"
        const entriesToDelete = await CalendarEntry.find({
          originalEntry: originalEntryId,
          _id: { $ne: currentEntry._id },
          completionStatus: { $nin: ["completed", "cancelled"] },
        }).select("_id");

        const entryIdsToDelete = entriesToDelete.map((entry) => entry._id);

        if (entryIdsToDelete.length > 0) {
          await CalendarEntry.deleteMany({ _id: { $in: entryIdsToDelete } });
          await CalendarHistory.deleteMany({ ref: { $in: entryIdsToDelete } });
        }
      };

      try {
        let currentEntry = await CalendarEntry.findById(entryId);
        let isRecChange = false;

        if (startTime && currentEntry.startTime) {
          if (startTime !== currentEntry.startTime.toISOString()) {
            isRecChange = true;
          }
        } else if (startTime && !currentEntry.startTime) {
          isRecChange = true;
        }

        if (endTime && endTime !== currentEntry.endTime.toISOString()) {
          isRecChange = true;
        }

        if (recurrence) {
          const currentRecurrenceObject = recStringToObject(
            currentEntry.recurrence,
          );
          if (
            recurrence.freq !== currentRecurrenceObject.freq ||
            new Date(recurrence.until).toISOString() !==
              new Date(currentRecurrenceObject.until).toISOString()
          ) {
            isRecChange = true;
          }
        }

        if (whenAlarm) {
          const currentWhenAlarmString = generateReminderOptions(
            currentEntry.startTime,
            currentEntry.endTime,
            currentEntry.whenAlarm,
          );
          if (whenAlarm !== currentWhenAlarmString) {
            isRecChange = true;
          }
        }

        if (category && category !== currentEntry.category) {
          isRecChange = true;
        }

        if (isRecChange) {
          await updateRecurrence(
            currentEntry,
            originalEntryId,
            startTime,
            endTime,
            recurrence,
            whenAlarm,
            category,
          );
          await handleRecurringEntries();
        }

        let entry = await CalendarEntry.findById(originalEntryId);
        if (!entry) {
          return { success: false, error: "Calendar entry not found." };
        }

        const history = await CalendarHistory.findOne({ ref: originalEntryId });
        if (!history) {
          return { success: false, error: "Calendar history not found." };
        }

        const changedFields = [];
        if (title && title !== entry.title) {
          entry.title = title;
          changedFields.push("title");
        }
        if (description && description !== entry.description) {
          entry.description = description;
          changedFields.push("description");
        }
        if (priority && priority !== entry.priority) {
          entry.priority = priority;
          changedFields.push("priority");
        }
        if (category && category !== entry.category) {
          entry.category = category;
          changedFields.push("category");
        }
        if (file && Array.isArray(file)) {
          entry.file = entry.file || [];
          const newFiles = file.filter((f) => !entry.file.includes(f));
          if (newFiles.length > 0) {
            entry.file.push(...newFiles);
            changedFields.push("file");
          }
        }
        let isEdit = false;
        if (changedFields.length > 0) {
          let filenames = [];
          let fileNotes = "";

          if (file && Array.isArray(file) && file.length > 0) {
            const fileDocs = await File.find({ _id: { $in: file } });
            filenames = fileDocs.map((doc) => doc.filename);
            fileNotes = filenames.length
              ? `${userFullName} uploaded a file called ${filenames.join(
                  ", ",
                )}.`
              : "";
          }

          const editFields = changedFields.filter((field) => field !== "file");
          if (editFields.length > 0) {
            const editNotes = `${userFullName} edited ${editFields.join(
              ", ",
            )}. `;
            history.edits.push({
              user: userId,
              notes: editNotes + fileNotes,
            });
            isEdit = true;
          } else if (fileNotes) {
            history.edits.push({
              user: userId,
              notes: fileNotes,
            });
            isEdit = true;
          }
        }

        await entry.save();
        await history.save();

        const activeCopies = await CalendarEntry.find({
          originalEntry: originalEntryId,
          completionStatus: { $nin: ["completed", "cancelled"] },
        }).distinct("_id");

        for (const copyId of activeCopies) {
          await CalendarEntry.findByIdAndUpdate(copyId, {
            $set: {
              title: title || entry.title,
              category: category || entry.category,
              priority: priority || entry.priority,
              description: description || entry.description,
              ...(file && { file: entry.file }),
            },
          });

          if (isEdit) {
            await CalendarHistory.findOneAndUpdate(
              { ref: copyId },
              {
                $push: {
                  edits: history.edits[history.edits.length - 1], // needs to change to only push if changes are made, not push the last edit every time
                },
              },
            );
          }
        }

        return { success: true, entry };
      } catch (error) {
        console.error("Error updating entry:", error);
        return { success: false, error };
      }
    };

    // Log the appropriate message based on the type
    let operationResult;
    switch (type) {
      case "cancel":
        console.log(`Cancelling the entry with id ${entryId}`);
        operationResult = await handleCancellations(
          entryId,
          originalEntryId,
          notes,
          file,
          userId,
          userFullName,
        );
        let additionalObject = {};
        additionalObject.completionStatus = "cancelled";
        if (file && Array.isArray(file)) {
          additionalObject.file = file;
        }
        if (notes) {
          additionalObject.notes = notes;
        }
        await runBusCalService(
          "cancel",
          entryId,
          userFullName,
          additionalObject,
        );
        break;
      case "reassign":
        console.log(`Reassigning the entry with id ${entryId}`);
        operationResult = await handleReassignments(
          entryId,
          originalEntryId,
          notes,
          file,
          userAssigned,
          userId,
          userFullName,
        );
        await runBusCalService("reassign", entryId, userFullName);
        break;
      case "edit":
        console.log(`Editing the entry with id ${entryId}`);
        operationResult = await handleEdits(
          originalEntryId,
          entryId,
          title,
          category,
          priority,
          description,
          file,
          userId,
          userFullName,
          startTime,
          endTime,
          recurrence,
          whenAlarm,
        );
        await runBusCalService("edit", entryId, userFullName);
        break;
      default:
        return res.status(400).json({ message: "Invalid type provided" });
    }

    if (operationResult && operationResult.success) {
      res.status(200).json({
        message: `${type} operation for entry ${entryId} processed successfully.`,
      });
    } else {
      res.status(500).json({
        error: "Internal server error.",
        details: operationResult.error,
      });
    }
  } catch (error) {
    console.error(
      `Error processing ${type} operation for entry ${entryId}:`,
      error,
    );
    res.status(500).json({ error: "Internal server error." });
  }
});
//-----------------------------------------------------------------------------------
//--------------------------------------CREATORS----------------------------------
//-----------------------------------------------------------------------------------

// @desc    Create a calendar entry
// @route   POST /api/calendar
// @access  Private
const createEntry = asyncHandler(async (req, res) => {
  const {
    title,
    userAssigned,
    description,
    startTime,
    endTime,
    whenAlarm,
    recurrence,
    priority,
    notes,
    category,
    file,
  } = req.body;

  console.log("New entry received: ", req.body);

  // Validate user information
  const userId = req.user?._id;
  const userFirstName = req.user?.firstName;
  const userLastName = req.user?.lastName;
  const userFullName =
    userFirstName && userLastName
      ? `${userFirstName} ${userLastName}`
      : userFirstName || "Unknown User";

  if (!userId || !userFirstName || !userLastName) {
    return res.status(400).json({ error: "User information is missing." });
  }

  // Validate required fields
  if (!title || !endTime) {
    return res
      .status(400)
      .json({ error: "Title and end time are required fields." });
  }

  const startTimeDate = new Date(startTime);
  const endTimeDate = new Date(endTime);

  // Validate if endTimeDate is a valid Date object
  if (isNaN(endTimeDate.getTime())) {
    return res.status(400).json({ error: "Invalid endTime format." });
  }

  // Determine whether to use startTimeDate or endTimeDate
  let timeDate = endTimeDate;
  if (["general", "event", "meeting"].includes(category)) {
    timeDate = startTimeDate;
  }
  // Validate timeDate
  if (isNaN(timeDate.getTime())) {
    return res.status(400).json({ error: "Invalid time provided." });
  }

  // Calculate reminder date based on whenAlarm value
  let reminder = null;
  switch (whenAlarm) {
    case "30 mins before":
      reminder = new Date(timeDate.getTime() - 30 * 60 * 1000);
      break;
    case "1 day before":
      reminder = new Date(timeDate.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "2 days before":
      reminder = new Date(timeDate.getTime() - 2 * 24 * 60 * 60 * 1000);
      break;
    case "1 week before":
      reminder = new Date(timeDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      reminder = null;
  }

  try {
    let assignee;

    // Search for the users with the specified email addresses
    if (
      userAssigned &&
      Array.isArray(userAssigned) &&
      userAssigned.length > 0
    ) {
      const users = await User.find({ email: { $in: userAssigned } });
      if (users.length !== userAssigned.length) {
        throw new Error(
          "One or more users with the provided email addresses not found",
        );
      }

      assignee = users.map((user) => String(user._id));
      console.log("Assigned the entry");
    } else {
      assignee = [String(req.user._id)];
      console.log("No assignees so assigned yourself");
    }

    let completionStatus = "not started";
    const recurrenceString = makeRecurrenceString(recurrence, timeDate);

    // Create the calendar entry data
    const entryData = {
      title,
      userOwner: req.user._id,
      userAssigned: assignee,
      endTime,
      whenAlarm: reminder,
      recurrence: recurrenceString,
      completionStatus,
      priority,
      file: Array.isArray(file) && file.length > 0 ? file : null,
    };

    // Conditionally add optional fields
    if (description) entryData.description = description;
    if (startTime) entryData.startTime = new Date(startTime);
    if (notes) entryData.notes = notes;
    if (category) entryData.category = category;

    // Create the calendar entry
    const entry = await CalendarEntry.create(entryData);

    // Create a new document in CalendarHistory
    const historyEntry = await CalendarHistory.create({
      ref: entry._id,
      assignments:
        assignee.length === 1
          ? [
              {
                user: assignee[0],
                notes: notes || `${userFullName} created the entry`,
              },
            ]
          : assignee.map((userId) => ({
              user: userId,
              notes: notes || `${userFullName} created the entry`,
            })),
    });
    // Call handleRecurringEntries after creating the entry
    await handleRecurringEntries();
    // Prepare additional data for calendar integration
    let additionalObject = {};

    // Add essential calendar data
    additionalObject.title = title;
    additionalObject.endTime = endTime;

    // Add optional fields if they exist
    if (description) {
      additionalObject.description = description;
    }

    if (startTime) {
      additionalObject.startTime = startTime;
    }

    if (file && Array.isArray(file) && file.length > 0) {
      additionalObject.file = file;
    }

    await runBusCalService("assign", entry._id, userFullName, additionalObject);
    res
      .status(201)
      .json({ message: "Calendar entry created successfully.", entry });
  } catch (error) {
    console.error("Error creating calendar entry:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

//-----------------------------------------------------------------------------------
//--------------------------------------DELETERS----------------------------------
//-----------------------------------------------------------------------------------
// @desc    Delete a calendar entry
// @route   DELETE /api/calendar/entries/:entryId
// @access  Private
const deleteEntry = asyncHandler(async (req, res) => {
  const entryId = req.params.entryId;
  const userId = req.user._id;
  const userFullName =
    req.user?.firstName && req.user?.lastName
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user?.firstName || "Unknown User";
  const notes = req.body.notes;

  try {
    // Retrieve the entry from the database using the provided id
    const calendarEntry = await CalendarEntry.findById(entryId);
    if (!calendarEntry) {
      return res.status(404).json({ message: "Calendar entry not found" });
    }
    const { completionStatus, userOwner, userAssigned, file } = calendarEntry;

    // Check the conditions
    if (
      completionStatus === "not started" &&
      userOwner.toString() === userAssigned[0].toString() &&
      userAssigned.length === 1
    ) {
      let additionalObject = {};
      additionalObject.completionStatus = "cancelled";
      if (file && Array.isArray(file) && file.length > 0) {
        additionalObject.file = file;
      }
      if (notes) {
        additionalObject.notes = notes;
      }
      await runBusCalService("cancel", entryId, userFullName, additionalObject);
      // Delete the entry if conditions are met
      await CalendarEntry.findByIdAndDelete(entryId);
      // Delete the corresponding CalendarHistory document
      await CalendarHistory.findOneAndDelete({ ref: entryId });
      // Delete the associated files if any
      if (file && file.length > 0) {
        for (const fileId of file) {
          const fileEntry = await File.findById(fileId);
          if (fileEntry) {
            const filePath = getUploadedFilePath(fileEntry.datafilename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            await File.findByIdAndDelete(fileId);
          }
        }
      }
      res.status(200).json({
        message: "Calendar entry, history, and associated files deleted",
      });
    } else {
      // Change the completionStatus to "cancelled" if conditions are not met
      calendarEntry.completionStatus = "cancelled";
      await calendarEntry.save();
      const historyNotes = `The user cancelled this entry. ${notes}`;
      // Append to the completionChanges array in the CalendarHistory document
      await CalendarHistory.findOneAndUpdate(
        { ref: entryId },
        {
          $push: {
            completionChanges: {
              user: userId,
              notes: historyNotes,
            },
          },
        },
      );
      let additionalObject = {};
      additionalObject.completionStatus = "cancelled";
      if (file && Array.isArray(file) && file.length > 0) {
        additionalObject.file = file;
      }
      if (notes) {
        additionalObject.notes = notes;
      }
      await runBusCalService("cancel", entryId, userFullName, additionalObject);
      res
        .status(200)
        .json({ message: "Calendar entry status updated to cancelled" });
    }
  } catch (error) {
    console.error("Error deleting/updating calendar entry:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @desc    Delete a recurring calendar entry and its copies
// @route   DELETE /api/calendar/entries/recur/:entryId
// @access  Private
const deleteRecurringEntries = asyncHandler(async (req, res) => {
  const entryId = req.params.entryId;

  try {
    // Retrieve the entry from the database using the provided id
    const calendarEntry = await CalendarEntry.findById(entryId);

    if (!calendarEntry) {
      return res.status(404).json({ message: "Calendar entry not found" });
    }

    let entriesToDelete = [];

    if (calendarEntry.originalEntry) {
      // If it is a recurring copy, find the original entry
      const originalEntryId = calendarEntry.originalEntry;
      const originalEntry = await CalendarEntry.findById(originalEntryId);

      if (!originalEntry) {
        return res
          .status(404)
          .json({ message: "Original calendar entry not found" });
      }

      // Find all copies of the original entry
      const recurringCopies = await CalendarEntry.find({
        originalEntry: originalEntryId,
      });

      entriesToDelete = [...recurringCopies, originalEntry];
    } else {
      // If it is the original entry, find all its copies
      const recurringCopies = await CalendarEntry.find({
        originalEntry: entryId,
      });

      entriesToDelete = [...recurringCopies, calendarEntry];
    }

    // Delete all entries and their corresponding histories
    for (const entry of entriesToDelete) {
      const entryId = entry._id;

      // Delete the entry
      await CalendarEntry.findByIdAndDelete(entryId);

      // Delete the corresponding CalendarHistory document
      await CalendarHistory.findOneAndDelete({ ref: entryId });

      // Delete the associated files if any
      if (entry.file && entry.file.length > 0) {
        for (const fileId of entry.file) {
          const fileEntry = await File.findById(fileId);
          if (fileEntry) {
            const filePath = getUploadedFilePath(fileEntry.datafilename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            await File.findByIdAndDelete(fileId);
          }
        }
      }
    }

    res.status(200).json({
      message: "Recurring calendar entry and its copies deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting recurring calendar entry:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = {
  createEntry,
  getAllEntry,
  getEntryById,
  updateEntry,
  reassignEntry,
  updateRecurringEntries,
  deleteEntry,
  deleteRecurringEntries,
  getUserEntries,
  getSupervisorEntries,
  getAllHistory,
  getHistoryById,
};
