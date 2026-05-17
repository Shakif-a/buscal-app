import React from "react";
import { Paper } from "@mui/material";
import EntryViewer from "./EntryViewer";
import { removeDomain } from "./UtilityFunctions";
import Typography from "@mui/material/Typography";

function UserEntryList({ userName, entries, type }) {
  const newEntries = removeDomain(entries);
  return (
    <div>
      {/* Display user-specific or generic task header */}
      {userName ? (
        <Typography variant="h5">{userName}'s Tasks</Typography>
      ) : (
        <Typography variant="h5">Your Tasks</Typography>
      )}

      {/* Render task entries */}
      <Paper
        sx={{
          padding: "5px",
          maxHeight: 670, // Maximum height
          minHeight: 400, // Minimum height
          overflow: "auto",
        }}
      >
        {newEntries && newEntries.length > 0 ? (
          newEntries.map((entry) => (
            <EntryViewer key={entry._id} entryData={entry} type={type} />
          ))
        ) : (
          <Typography variant="body1">No entries found.</Typography>
        )}
      </Paper>
    </div>
  );
}

export default UserEntryList;
