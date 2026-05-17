import React, { useState } from "react";
import {
  Typography,
  Button,
  Slider,
  Box,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  Collapse,
  Link,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { updateEntry } from "../features/calendar/calendarSlice";
import FileAttachment from "./FileAttachment";
import "react-toastify/dist/ReactToastify.css";

const ChangeCompletionStatus = ({
  status,
  id,
  title,
  progress = 0,
  onCancel,
}) => {
  const [description, setDescription] = useState("");
  const [fileId, setFileId] = useState(null);
  const [sliderValue, setSliderValue] = useState(progress);
  const [isButtonEnabled, setIsButtonEnabled] = useState(false);
  const [showProgressOptions, setShowProgressOptions] = useState(
    progress > 0 && progress < 100
  );
  const [isComplete, setIsComplete] = useState(progress === 100);
  const dispatch = useDispatch();

  const [updatedStatus, setUpdatedStatus] = useState(status);

  const handleCheckboxChange = (event) => {
    const checked = event.target.checked;
    setIsComplete(checked);

    if (checked) {
      setSliderValue(100);
      if (
        status === "not started" ||
        status === "in progress" ||
        status === "overdue"
      ) {
        setUpdatedStatus("completed");
      }
    } else {
      // If unchecking and slider was at 100, set it to previous logical value
      const newValue = progress === 100 ? 0 : sliderValue;
      setSliderValue(newValue);

      if (newValue === 0) {
        setUpdatedStatus("not started");
      } else {
        setUpdatedStatus("in progress");
      }
    }
    enableButton();
  };

  const handleSliderChange = (event, newValue) => {
    setSliderValue(newValue);
    setIsComplete(newValue === 100);
    enableButton();

    if (status === "not started" && newValue < 100 && newValue > 0) {
      setUpdatedStatus("in progress");
    } else if (newValue === 100 && status !== "cancelled") {
      setUpdatedStatus("completed");
    } else if (newValue === 0) {
      setUpdatedStatus("not started");
    } else if (status === "in progress" || status === "overdue") {
      setUpdatedStatus(status);
    }
  };

  const toggleProgressOptions = () => {
    setShowProgressOptions(!showProgressOptions);
  };

  const handleUpdate = async () => {
    const entryData = {
      completionStatus: updatedStatus,
      progress: sliderValue,
    };

    if (description) {
      entryData.notes = description;
    }
    if (fileId) {
      entryData.file = fileId;
    }

    try {
      dispatch(updateEntry({ entryId: id, entryData }));
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      toast.success("Updated successfully!");
    } catch (error) {
      toast.error("Failed to update.");
      console.error("Error updating entry:", error);
    }
  };

  const handleDescriptionChange = (description) => {
    setDescription(description);
    enableButton();
  };

  const getFileID = (fileIDs) => {
    setFileId(fileIDs);
    enableButton();
  };

  const enableButton = () => {
    setIsButtonEnabled(true);
  };

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {/* Checkbox for quick completion */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={isComplete}
              onChange={handleCheckboxChange}
              size="large"
            />
          }
          label={<Typography variant="h6">Mark as Complete</Typography>}
        />
      </Box>

      {/* Collapsible Progress Options */}
      <Box sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body2"
          onClick={toggleProgressOptions}
          sx={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {showProgressOptions ? <ExpandLess /> : <ExpandMore />}
          {showProgressOptions
            ? "Hide Progress Options"
            : "Show Progress Options"}
        </Link>

        <Collapse in={showProgressOptions}>
          <Box
            sx={{
              width: "100%",
              mt: 2,
              p: 2,
              bgcolor: "grey.50",
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" gutterBottom>
              Current Progress: {sliderValue}%
            </Typography>
            <Slider
              value={sliderValue}
              onChange={handleSliderChange}
              aria-labelledby="progress-slider"
              valueLabelDisplay="auto"
              min={0}
              max={100}
            />
            <FormHelperText>
              Use the slider to set specific progress percentage
            </FormHelperText>
          </Box>
        </Collapse>
      </Box>

      <FileAttachment
        placeholder="Add a note"
        onDescriptionChange={handleDescriptionChange}
        getFileID={getFileID}
      />

      <div style={{ marginTop: "20px", textAlign: "right" }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpdate}
          style={{ marginRight: "10px" }}
          disabled={!isButtonEnabled}
        >
          Update
        </Button>
        <Button variant="contained" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default ChangeCompletionStatus;
