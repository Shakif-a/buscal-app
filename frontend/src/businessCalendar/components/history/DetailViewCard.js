import React from "react";
import Paper from "@mui/material/Paper";
import EntryViewer from "../EntryViewer";
import VerticalTimeline from "./VerticalTimeline";
import moment from "moment";

const DetailViewCard = ({ entry, histories, users }) => {
  // Check if entry is provided
  if (!entry) {
    return <p>No entry</p>;
  }

  // Add checks for required props
  if (!Array.isArray(histories)) {
    console.error("DetailViewCard: histories is not an array");
    return <p>Loading history...</p>;
  }

  if (!Array.isArray(users)) {
    console.error("DetailViewCard: users is not an array");
    return <p>Loading users...</p>;
  }

  // Find the corresponding history object for the entry
  const history = findHistoryByEntryId(histories, entry._id);
  const timelineData = transformHistoriesToTimeline(history);
  const updatedTimelineData = replaceIdwithName(timelineData, users);

  return (
    <Paper elevation={3} style={{ padding: "16px" }}>
      <EntryViewer key={entry._id} entryData={entry} type={"history"} />
      <h3>Timeline</h3>
      {updatedTimelineData.length > 0 ? (
        <VerticalTimeline data={updatedTimelineData} />
      ) : (
        <p>No timeline data available</p>
      )}
    </Paper>
  );
};

export default DetailViewCard;

export const replaceIdwithName = (timelineData, users) => {
  if (!Array.isArray(timelineData) || !Array.isArray(users)) {
    console.warn("replaceIdwithName called with invalid data");
    return [];
  }

  return timelineData.map((item) => {
    const userObj = users.find((user) => user._id === item.user);
    if (userObj && userObj.firstName && userObj.lastName) {
      const fullName = `${userObj.firstName} ${userObj.lastName}`;
      return { ...item, user: fullName };
    } else {
      console.log("User not found for:", item.user);
      return { ...item, user: "System" };
    }
  });
};

const findHistoryByEntryId = (histories, entryId) => {
  // Iterate through HISTORIES array to find the matching history object
  for (const history of histories) {
    if (history.ref === entryId) {
      // If a matching history object is found, return a copy of it
      return { ...history };
    }
  }
  // If no matching history object is found, return null
  return null;
};

export const transformHistoriesToTimeline = (histories) => {
  //null check
  if (!histories) {
    console.warn(
      "transformHistoriesToTimeline called with null/undefined histories"
    );
    return [];
  }
  // Helper function to extract items and set type
  const extractItems = (type, items = []) => {
    return items.map((item) => ({
      timestamp: new Date(item.timestamp).toLocaleString("en-AU"),
      user: item.user,
      notes: item.notes,
      type: type,
    }));
  };

  // Extract items from each history type and concatenate them into timelineItems
  const allItems = [
    ...extractItems("assignment", histories.assignments),
    ...extractItems("reassignment", histories.reassignments),
    ...extractItems("escalation", histories.escalations),
    ...extractItems("notification", histories.notifications),
    ...extractItems("edit", histories.edits),
    ...extractItems("completion", histories.completionChanges),
  ];

  // Sort the items chronologically
  const sortedItems = allItems.sort((a, b) => {
    const dateA = moment(a.timestamp, "DD/MM/YYYY, h:mm:ss a");
    const dateB = moment(b.timestamp, "DD/MM/YYYY, h:mm:ss a");
    return dateA - dateB;
  });
  return sortedItems;
};
