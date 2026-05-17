import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  deleteEntry,
  updateEntry,
  deleteRecurringEntries,
  updateRecurringEntries,
} from "../features/calendar/calendarSlice";
import FileAttachment from "./FileAttachment";

const DeleteModal = ({ entryId, onCancel, isDeleteNotes, applyToSeries }) => {
  const dispatch = useDispatch();
  const [notes, setNotes] = useState("");
  const [fileId, setFileId] = useState(null);

  const handleDelete = async () => {
    try {
      if (applyToSeries) {
        if (isDeleteNotes) {
          const entryData = { type: "cancel", file: fileId, notes };
          dispatch(updateRecurringEntries({ entryId, entryData }));
        } else {
          dispatch(deleteRecurringEntries(entryId));
        }
      } else {
        if (fileId) {
          const entryData = { file: fileId };
          dispatch(updateEntry({ entryId, entryData }));
        }
        dispatch(deleteEntry({ entryId, notes }));
      }

      toast.success("Entry deleted successfully");

      setTimeout(() => {
        window.location.reload();
      }, 1000);

      onCancel();
    } catch (error) {
      console.error("Failed to delete the entry:", error);
      toast.error("Failed to delete the entry");
    }
  };

  const handleNotesChange = (notes) => {
    setNotes(notes);
  };

  const getFileID = (fileIDs) => {
    setFileId(fileIDs);
  };

  return (
    <Box
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <Box>
        {isDeleteNotes && (
          <FileAttachment
            placeholder="Why is this being cancelled"
            onDescriptionChange={handleNotesChange}
            getFileID={getFileID}
          />
        )}
      </Box>
      <p>Are you sure you want to delete this entry?</p>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
        <Button
          variant="contained"
          color="success"
          onClick={handleDelete}
          style={{ marginRight: "10px" }}
        >
          Yes
        </Button>
        <Button variant="contained" onClick={onCancel} color="error">
          No
        </Button>
      </Box>
    </Box>
  );
};

export default DeleteModal;
