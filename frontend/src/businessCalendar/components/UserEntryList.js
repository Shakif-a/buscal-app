import React from "react";
import { Box, Typography } from "@mui/material";
import EntryViewer from "./EntryViewer";
import { removeDomain } from "./UtilityFunctions";
import { display, flexDirection } from "@mui/system";

function UserEntryList({ userName, entries, type }) {
  const newEntries = removeDomain(entries);
  return (
    <Box
      sx={{width: "100%", mt: 3}}
    >
      {/* Display user-specific or generic task header */}
      <Typography
        variant="h5"
        sx={{
          fontFamily: "Avenir, sans-serif",
          fontSize: "26px",
          fontWeight: 500,
          color: "#44445a",
          mb: 2.5,
        }}
      >
        {userName ? `${userName}'s Tasks` : "Your Tasks"}
      </Typography>

      {/* Render task entries */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          width: "100%",
          maxHeight: 670, // Maximum height
          overflowY: "auto",
          overflowX: "hidden",
          backgroundColor: "transparent",
          pr: 1,
          pb: 2,
        }}
      >
        {newEntries && newEntries.length > 0 ? (
          newEntries.map((entry) => (
            <EntryViewer key={entry._id} entryData={entry} type={type} />
          ))
        ) : (
          <Typography sx={{ color: "#666", py: 2}}>No entries found.</Typography>
        )}
      </Box>
    </Box>
  );
}

export default UserEntryList;
