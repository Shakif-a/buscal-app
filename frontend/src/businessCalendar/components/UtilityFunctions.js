/*
UtilityFunctions.js

This file contains helper functions for manipulating data related to entries and users.
It provides functions for replacing object IDs with corresponding emails, sorting entries
based on the endTime field, and removing the domain part from email addresses in entries.

Functions:
- generateReminderOptions: Determines the appropriate reminder string based on the time
  difference between a given start/end time and an alarm time.
- removeDuplicateEntries: Removes duplicate entries from an array based on a
  reference array of objects using their _id field.
- getCategoryColour: Here is where the colours are defined for the program for all
  entry categories
- replaceObjectId: Replaces object IDs in a specified field of an array of objects with
  corresponding full names using a provided array of users.
- sortEntries: Sorts an array of entries in chronological order based on the endTime field.
- replaceFullName: Replaces object IDs with corresponding email addresses using a provided
  array of users.
- removeDomain: Removes the domain part from email addresses in entries, updating both the
  userOwner field and the userAssigned array.
- filterEntriesByStatus: Filters entries based on given completion status in the second input
  array.
- textFilter: Filters entries based on the given searchText
- findEntryById: Given Object ID, find one entry object from the entries array.
*/
export const generateReminderOptions = (startTime, endTime, whenAlarm) => {
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
export const removeDuplicateEntries = (modifiedArray, referenceArray) => {
  // Check if both modifiedArray and referenceArray are arrays
  if (!Array.isArray(modifiedArray) || !Array.isArray(referenceArray)) {
    console.error("One or both of the provided arguments are not arrays.");
    return []; // Return an empty array or handle it as needed
  }

  // Create a set of unique _id values from referenceArray
  const referenceIds = new Set(referenceArray.map((obj) => obj._id));

  // Filter modifiedArray to exclude objects with matching _id
  const filteredArray = modifiedArray.filter(
    (obj) => !referenceIds.has(obj._id)
  );

  return filteredArray;
};

// Get background color based on category
export const getCategoryColour = (category) => {
  if (!category) {
    return "#ffffff"; // Default to white if category is undefined
  }
  let backgroundColor;
  switch (category.toLowerCase()) {
    case "general":
      backgroundColor = "#5c7f89"; // greyish
      break;
    case "task":
      backgroundColor = "#28a745"; // green
      break;
    case "action":
      backgroundColor = "#4169e1"; // royal blue
      break;
    case "event":
      backgroundColor = "#6f42c1"; // purple
      break;
    case "meeting":
      backgroundColor = "#20c997"; // teal
      break;
    case "businessdeadline":
      backgroundColor = "#e55b50"; // red
      break;
    case "leave":
      backgroundColor = "#0dcaf0"; // Light Blue
      break;
    default:
      backgroundColor = "#0a9db8"; // Default to general
  }
  return backgroundColor;
};

export const findEntryById = (id, entries) => {
  // Search for the entry with the given id
  const entry = entries.find((entry) => entry._id === id);

  // If entry is found, return a copy of the entry
  if (entry) {
    return { ...entry };
  } else {
    // If entry is not found, log an error
    console.error(`Entry with id '${id}' not found`);
    return null;
  }
};

// Filter entries based on searchText
export const textFilter = (entries, searchText) => {
  if (!searchText.trim()) return entries; // If searchText is empty, return all entries

  const lowerCaseSearchText = searchText.toLowerCase();
  return entries.filter((entry) => {
    const title = entry.title?.toLowerCase() || "";
    const description = entry.description?.toLowerCase() || "";
    const notes = entry.notes?.toLowerCase() || "";
    return (
      title.toLowerCase().includes(lowerCaseSearchText) ||
      description.toLowerCase().includes(lowerCaseSearchText) ||
      notes.toLowerCase().includes(lowerCaseSearchText)
    );
  });
};

// Function to replace object IDs with full names
export const replaceObjectId = (users, changeArray, field) => {
  // Check if users array is provided
  if (!users || !Array.isArray(users)) {
    return changeArray;
  }

  // Map over each entry in changeArray
  const changedArray = changeArray.map((entry) => {
    // Create a copy of the entry object to avoid mutation
    const newEntry = { ...entry };

    // Replace IDs with full names in the specified field
    const replaced = replaceFullName(newEntry[field], users);
    newEntry[field] = replaced;

    return newEntry;
  });

  return changedArray;
};

export const filterEntriesByStatus = (entries, statusesToFilter) => {
  if (
    !Array.isArray(entries) ||
    entries.length === 0 ||
    !Array.isArray(statusesToFilter) ||
    statusesToFilter.length === 0
  ) {
    return [];
  }

  // Filter the entries array based on the completionStatus field and the provided statuses to filter
  const filteredEntries = entries.filter((entry) => {
    return statusesToFilter.includes(entry.completionStatus);
  });

  return filteredEntries;
};

export const sortEntries = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries;
  }

  // Sort the entries array based on the endTime field
  const sortedEntries = entries.sort((a, b) => {
    // Convert the endTime strings to Date objects for comparison
    const endTimeA = new Date(a.endTime);
    const endTimeB = new Date(b.endTime);

    // Compare the dates and return the result
    if (endTimeA < endTimeB) {
      return -1;
    } else if (endTimeA > endTimeB) {
      return 1;
    } else {
      return 0;
    }
  });

  return sortedEntries;
};

// Function to replace IDs with corresponding full names
function replaceFullName(ids, users) {
  // Check if users array is provided and is an array
  if (!Array.isArray(users) || users.length === 0) {
    return ids;
  }

  // Check if ids is an array
  if (Array.isArray(ids)) {
    // Map over each ID in the ids array to find the corresponding full name
    const updatedArray = ids.map((id) => {
      // Find the corresponding user object
      const user = users.find((user) => user._id === id);

      // If user is found, return the full name, otherwise return the original ID
      return user ? `${user.firstName} ${user.lastName}` : id;
    });

    return updatedArray;
  } else if (typeof ids === "string") {
    // Find the corresponding user object for the single ID string
    const user = users.find((user) => user._id === ids);

    // If user is found, return the full name, otherwise return the original ID
    return user ? `${user.firstName} ${user.lastName}` : ids;
  } else {
    console.error("Invalid input: IDs should be either an array or a string");
    return ids;
  }
}

export const removeDomain = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    return entries;
  }

  // Iterate over each object in the array
  const updatedEntries = entries.map((entry) => {
    // Check if the entry has a userOwner field with an email address
    if (entry.userOwner && typeof entry.userOwner === "string") {
      // Split the email address at '@' and return the part before '@'
      const ownerWithoutDomain = entry.userOwner.split("@")[0];
      // Update the userOwner field with the email address without the domain part
      entry.userOwner = ownerWithoutDomain;
    }

    // Check if the entry has a userAssigned array with email addresses
    if (entry.userAssigned && Array.isArray(entry.userAssigned)) {
      // Update each email address in the userAssigned array without the domain part
      entry.userAssigned = entry.userAssigned.map(
        (email) => email.split("@")[0]
      );
    }

    return entry;
  });

  return updatedEntries;
};
