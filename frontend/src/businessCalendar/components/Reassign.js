import React, { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import FileAttachment from "./FileAttachment";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import {
  reassignEntry,
  updateRecurringEntries,
} from "../features/calendar/calendarSlice";

const Reassign = ({ entryId, emailList, onCancel, applyToSeries }) => {
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState("");
  const [fileId, setFileId] = useState(null);

  const dispatch = useDispatch();

  const handleCancel = () => {
    if (typeof onCancel === "function") {
      onCancel();
    }
  };

  const handleUpdate = () => {
    const reassignmentData = {
      userAssigned: selected,
      notes,
      file: fileId ? [fileId] : [],
    };

    if (applyToSeries) {
      const entryData = {
        type: "reassign",
        ...reassignmentData,
      };
      dispatch(updateRecurringEntries({ entryId, entryData }))
        .unwrap()
        .then(() => {
          toast.success("Reassignment for series successful");
          handleCancel();
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        })
        .catch((error) => {
          console.error("Error reassigning recurring entries:", error);
          toast.error("Error reassigning recurring entries: " + error.message);
        });
    } else {
      dispatch(reassignEntry({ entryId, reassignmentData }))
        .unwrap()
        .then(() => {
          toast.success("Reassignment successful");
          handleCancel();
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        })
        .catch((error) => {
          console.error("Error reassigning entry:", error);
          toast.error("Error reassigning entry: " + error.message);
        });
    }
  };

  return (
    <Box
      onClick={(event) => {
        event.stopPropagation();
      }}
      sx={{
        minHeight: "150px",
        minWidth: "300px",
        width: "fit-content",
        height: "fit-content",
        padding: "5px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Autocomplete
        multiple
        value={selected}
        onChange={(event, newValue) => {
          setSelected(newValue);
        }}
        id="tags-outlined"
        options={emailList}
        fullWidth
        filterSelectedOptions
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            label={"Reassign a user"}
            fullWidth
          />
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip key={index} label={option} {...getTagProps({ index })} />
          ))
        }
      />
      <Box width={550} marginTop={5} marginBottom={5}>
        <FileAttachment
          placeholder={"Notes for Reassignment"}
          onDescriptionChange={(desc) => setNotes(desc)}
          getFileID={(fileID) => setFileId(fileID)}
        />
      </Box>

      <div style={{ marginTop: "20px", textAlign: "right" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpdate}
          style={{ marginRight: "10px" }}
        >
          Update
        </Button>
        <Button variant="contained" color="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </Box>
  );
};

export default Reassign;
