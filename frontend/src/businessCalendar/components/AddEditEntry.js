import React, { useState, useEffect } from "react";
import FormControl from "@mui/material/FormControl";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";
import TextField from "@mui/material/TextField";
import Checkbox from "@mui/material/Checkbox";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import DatePickerBusCal from "./calendar/DatePickerBusCal";
import DropdownSelect from "./DropdownSelect";
import CustomRecurrence from "./CustomRecurrence";
import FileAttachment from "./FileAttachment";
import { useDispatch } from "react-redux";
import { generateReminderOptions, getCategoryColour } from "./UtilityFunctions";

const AddEditEntry = ({
  handleAddNewEntry,
  onCancel,
  emailList,
  type,
  entryData,
}) => {
  const [formData, setFormData] = useState({
    title: "",
    startTime: new Date(),
    endTime: new Date(),
    recurrence: "None",
    until: null,
    category: "general",
    priority: "Normal",
    whenAlarm: null,
    description: "",
    userAssigned: [],
    file: [],
  });

  const [duration, setDuration] = useState("-");
  const [isReminder, setIsReminder] = useState(false);
  const [titleError, setTitleError] = useState(false);

  const dispatch = useDispatch();

  /*---------------------- useEffect ----------------------*/
  // Use useEffect to set initial formData values when entryData changes
  useEffect(() => {
    if (entryData) {
      // If entryData is provided and the type is "edit"
      const domain = "@micromax.com.au";
      let newUserAssigned = entryData.userAssigned.map(
        (string) => string + domain
      );
      let reminder = null;
      if (entryData.whenAlarm) {
        setIsReminder(true);
        reminder = generateReminderOptions(
          entryData.startTime,
          entryData.endTime,
          entryData.whenAlarm
        );
      }

      // Recurrence options
      const recurrenceOptions = [
        "None",
        "Daily",
        "Weekly",
        "Monthly",
        "Quarterly",
        "Yearly",
      ];

      // Function to capitalize the first letter of a string
      const capitalizeFirstLetter = (str) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
      };

      // Recurrence handling logic
      const recurrence = entryData.recurrence
        ? recurrenceOptions.includes(
            capitalizeFirstLetter(entryData.recurrence.freq.toLowerCase())
          )
          ? capitalizeFirstLetter(entryData.recurrence.freq.toLowerCase())
          : "None"
        : "None";

      // Update formData with entryData values
      setFormData({
        title: entryData.title,
        startTime: new Date(entryData.startTime),
        endTime: new Date(entryData.endTime),
        recurrence: recurrence,
        until: entryData.recurrence?.until ?? null,
        category: entryData.category,
        priority: capitalizeFirstLetter(entryData.priority),
        whenAlarm: reminder,
        description: entryData.description,
        userAssigned: newUserAssigned,
        file: entryData.file,
      });
    }
  }, [entryData, type]); // Re-run the effect when entryData or type changes

  /*---------------------- HANDLERS ----------------------*/
  const handleUpdate = () => {
    if (!formData.title.trim()) {
      setTitleError(true);
      return;
    }
    if (
      formData.startTime &&
      formData.endTime &&
      formData.endTime < formData.startTime
    ) {
      alert("The end time cannot be before the start time.");
      return;
    }
    if (
      formData.until &&
      formData.endTime &&
      formData.until < formData.endTime
    ) {
      alert("The until time cannot be before the end time.");
      return;
    }
    setTitleError(false);
    handleAddNewEntry(formData, dispatch);
  };

  // Function to handle change in start time
  const handleStartTimeChange = (date) => {
    setFormData((prevFormData) => {
      let newEndTime = prevFormData.endTime;

      // If both startTime and endTime exist, and new startTime is after current endTime
      if (date && prevFormData.endTime && date >= prevFormData.endTime) {
        // Set endTime to 1 hour after the new startTime
        newEndTime = new Date(date);
        newEndTime.setHours(newEndTime.getHours() + 1);
      }

      return {
        ...prevFormData,
        startTime: date,
        endTime: newEndTime,
      };
    });

    if (formData.category === "meeting") {
      setDuration("-");
    }
  };

  // Function to handle change in duration
  const handleDurationChange = (event) => {
    setDuration(event);
    let durationNum = parseFloat(event);
    if (durationNum < 29) {
      durationNum = durationNum * 60;
    }
    const endDate = new Date(formData.startTime);
    endDate.setMinutes(endDate.getMinutes() + durationNum);

    setFormData((prevFormData) => ({
      ...prevFormData,
      endTime: endDate,
    }));
  };

  const handleEndTimeChange = (date) => {
    setDuration("-");
    const endDate = new Date(date);
    endDate.setHours(endDate.getHours() + 1);

    if (formData.category === "meeting") {
      setFormData((prevFormData) => ({
        ...prevFormData,
        endTime: endDate,
      }));
    } else {
      setFormData((prevFormData) => ({
        ...prevFormData,
        endTime: date,
      }));
    }
  };

  // Function to update category
  const handleCategoryChange = (value) => {
    // Update the category
    setFormData((prevFormData) => ({
      ...prevFormData,
      category: value,
    }));
    if (value === "task") {
      setFormData((prevFormData) => ({
        ...prevFormData,
        recurrence: "None",
        until: null,
      }));
    }
    // Update the priority based on the selected category
    if (
      value === "businessdeadline" ||
      value === "task" ||
      value === "action"
    ) {
      setFormData((prevFormData) => ({
        ...prevFormData,
        startTime: null,
      }));
    } else if (formData.startTime) {
      setFormData((prevFormData) => ({
        ...prevFormData,
      }));
    } else {
      setFormData((prevFormData) => ({
        ...prevFormData,
        startTime: new Date(),
      }));
    }
    if (value === "businessdeadline") {
      // If the category is "businessdeadline", set priority to "High"
      setFormData((prevFormData) => ({
        ...prevFormData,
        priority: "High",
      }));
    } else {
      // Otherwise, set priority to "Normal"
      setFormData((prevFormData) => ({
        ...prevFormData,
        priority: "Normal",
      }));
    }
  };

  const handleRepeat = (value) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      recurrence: value, // Update formData.recurrence with the selected value
    }));
  };
  const handleUntilChange = (value) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      until: value,
    }));
  };

  const handleReminder = (value) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      whenAlarm: value,
    }));
  };

  const handlePriorityChange = (value) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      priority: value,
    }));
  };

  const handleDescriptionChange = (value) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      description: value,
    }));
  };

  const handleUserAssigned = (event, newValue) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      userAssigned: newValue,
    }));
  };

  const handleFileChange = (fileIds) => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      file: fileIds,
    }));
  };

  return (
    <Box
      display="grid"
      gridTemplateColumns="1fr 1fr 1fr 1fr"
      gridTemplateRows="auto auto 1fr auto auto auto auto"
      gap="8px"
      minWidth="700px"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {/* Box 1 - Title dates*/}
      <Box
        gridColumn="1 / 3"
        gridRow="1 / 2"
        display="flex"
        flexDirection="column"
        alignItems="flex-start"
        padding="10px"
        gap={3}
      >
        <TextField
          name="title"
          label="Title"
          variant="outlined"
          fullWidth
          value={formData.title} // Set value to formData.title
          error={titleError}
          helperText={titleError ? "Please put a title" : ""}
          onChange={(e) =>
            setFormData((prevFormData) => ({
              ...prevFormData,
              title: e.target.value, // Update formData.title with the new value
            }))
          }
        />

        {/* Box 1.5 - Start time, duration */}
        <Box display="flex" flexDirection="row" alignItems="flex-start" gap={1}>
          {(formData.category === "general" ||
            formData.category === "event" ||
            formData.category === "meeting") && (
            <DatePickerBusCal
              label="Start Time"
              setDate={handleStartTimeChange}
              value={formData.startTime}
            />
          )}
          {formData.category === "meeting" && (
            <DropdownSelect
              title={"Duration"}
              getter={duration}
              setter={handleDurationChange}
              mitems={[
                "-",
                "30 mins",
                "1 hr",
                "1.5 hrs",
                "2 hrs",
                "2.5 hrs",
                "3 hrs",
              ]}
              minWidth={"90px"}
              maxWidth={"150px"}
              backgroundColor="White"
              margin={1}
            />
          )}
        </Box>

        <DatePickerBusCal
          label={
            formData.category === "general" ||
            formData.category === "event" ||
            formData.category === "meeting"
              ? "End Time"
              : "Due Date"
          }
          value={formData.endTime}
          setDate={handleEndTimeChange}
        />
      </Box>

      {/* Box 2 - Category */}
      <Box
        gridColumn="3 / 5"
        gridRow="1 / 2"
        display="flex"
        alignItems="flex-start"
        padding="10px"
      >
        <FormControl>
          <RadioGroup
            aria-label="category"
            name="category"
            value={formData.category} // Set the value
            onChange={(e) => handleCategoryChange(e.target.value)}
            sx={{
              "& .MuiTypography-root": { fontSize: "0.9rem" },
              "& .MuiSvgIcon-root": { fontSize: 15 },
            }}
          >
            <FormControlLabel
              value="general"
              control={<Radio size="small" />}
              label={
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="150px"
                >
                  <span>General</span>
                  <Box
                    sx={{
                      width: "15px",
                      height: "15px",
                      backgroundColor: getCategoryColour("general"),
                      borderRadius: "0%",
                      marginLeft: "8px",
                    }}
                  />
                </Box>
              }
            />
            <FormControlLabel
              value="task"
              control={<Radio size="small" />}
              label={
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="150px"
                >
                  <span>Task</span>
                  <Box
                    sx={{
                      width: "15px",
                      height: "15px",
                      backgroundColor: getCategoryColour("task"),
                      borderRadius: "0%",
                      marginLeft: "8px",
                    }}
                  />
                </Box>
              }
            />
            <FormControlLabel
              value="action"
              control={<Radio size="small" />}
              label={
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="150px"
                >
                  <span>Action</span>
                  <Box
                    sx={{
                      width: "15px",
                      height: "15px",
                      backgroundColor: getCategoryColour("action"),
                      borderRadius: "0%", // Square shape
                      marginLeft: "8px",
                    }}
                  />
                </Box>
              }
            />

            <FormControlLabel
              value="event"
              control={<Radio size="small" />}
              label={
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="150px"
                >
                  <span>Event</span>
                  <Box
                    sx={{
                      width: "15px",
                      height: "15px",
                      backgroundColor: getCategoryColour("event"),
                      borderRadius: "0%", // Square shape
                      marginLeft: "8px",
                    }}
                  />
                </Box>
              }
            />

            <FormControlLabel
              value="meeting"
              control={<Radio size="small" />}
              label={
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="150px"
                >
                  <span>Meeting</span>
                  <Box
                    sx={{
                      width: "15px",
                      height: "15px",
                      backgroundColor: getCategoryColour("meeting"),
                      borderRadius: "0%", // Square shape
                      marginLeft: "8px",
                    }}
                  />
                </Box>
              }
            />

            <FormControlLabel
              value="businessdeadline"
              control={<Radio size="small" />}
              label={
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="150px"
                >
                  <span>Business Deadline</span>
                  <Box
                    sx={{
                      width: "15px",
                      height: "15px",
                      backgroundColor: getCategoryColour("businessdeadline"),
                      borderRadius: "0%",
                      marginLeft: "8px",
                    }}
                  />
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </Box>

      {/* Box 3 - Repeats */}
      <Box
        gridColumn="1 / 5"
        gridRow="2 / 3"
        display="flex"
        alignItems="flex-start"
        padding="10px"
        gap={1}
      >
        {formData.category !== "task" && (
          <FormControl>
            <DropdownSelect
              title={"Repeat"}
              getter={formData.recurrence} // Set the getter to formData.recurrence
              setter={handleRepeat} // Pass the handler function to update recurrence
              mitems={[
                "None",
                "Daily",
                "Weekly",
                "Monthly",
                "Quarterly",
                "Yearly",
              ]}
              minWidth={"120px"}
              maxWidth={"200px"}
              backgroundColor="White"
              margin={1}
            />
          </FormControl>
        )}

        {formData.recurrence !== "None" && formData.category !== "task" ? (
          <DatePickerBusCal
            label="Until"
            setDate={handleUntilChange}
            value={formData.until}
            helperText="Leave it blank for indefinite repeats"
          />
        ) : null}

        {/* <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxWidth: "300px",
          minWidth: "200px",
          height: "fit-content",
        }}
      >
      To be refined and implemented later
        <CustomRecurrence />
      </div> */}
      </Box>

      {/* Box 4 - Reminder */}
      <Box
        gridColumn="1 / 5"
        gridRow="3 / 4"
        display="flex"
        alignItems="flex-start"
        padding="10px"
        gap={10}
      >
        <FormControl>
          <FormControlLabel
            control={
              <Checkbox
                name="setReminder"
                color="primary"
                checked={isReminder}
                onChange={(e) => {
                  setIsReminder(e.target.checked);
                  if (!e.target.checked) {
                    setFormData((prevFormData) => ({
                      ...prevFormData,
                      whenAlarm: null, // Reset whenAlarm to null when isReminder is false
                    }));
                  } else {
                    handleReminder("30 mins before");
                  }
                }}
              />
            }
            label="Set reminder"
          />
        </FormControl>
        {isReminder && (
          <FormControl>
            <DropdownSelect
              title={"Reminder"}
              getter={formData.whenAlarm || "30 mins before"} // Use formData.whenAlarm or default value
              setter={handleReminder} // Pass the handler function to update whenAlarm
              mitems={[
                "30 mins before",
                "1 day before",
                "2 days before",
                "1 week before",
              ]}
              minWidth={"120px"}
              maxWidth={"200px"}
              backgroundColor="White"
              margin={1}
            />
          </FormControl>
        )}
      </Box>

      {/* Box 5 - Priority */}
      <Box
        gridColumn="1 / 3"
        gridRow="4 / 5"
        display="flex"
        alignItems="flex-start"
        padding="10px"
      >
        <FormControl>
          <DropdownSelect
            title="Priority"
            getter={formData.priority}
            setter={handlePriorityChange}
            mitems={["Normal", "High"]}
            minWidth={"120px"}
            maxWidth={"200px"}
            backgroundColor="White"
            margin={1}
          />
        </FormControl>
      </Box>

      {/* Box 6 - Description, file*/}
      <Box gridColumn="1 / 5" gridRow="5 / 6" padding="10px">
        <FileAttachment
          placeholder={"Description"}
          onDescriptionChange={handleDescriptionChange}
          givenDesc={type === "edit" ? entryData.description : undefined}
          getFileID={handleFileChange}
        />
      </Box>

      {/* Box 7 - Assign */}
      <Box gridColumn="1 / 5" gridRow="6 / 7" padding="10px">
        <FormControl sx={{ width: "50%" }}>
          <Autocomplete
            multiple
            id="tags-outlined"
            options={emailList}
            value={formData.userAssigned}
            fullWidth
            filterSelectedOptions
            disabled={type === "edit"}
            onChange={handleUserAssigned}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label={"Assign a user"}
                fullWidth
                helperText="If unselected, entry assigned to yourself."
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip label={option} {...getTagProps({ index })} />
              ))
            }
          />
        </FormControl>
      </Box>

      {/* Box 8 - Buttons */}
      <Box
        gridColumn="4 / 5"
        gridRow="7 / 8"
        display="flex"
        alignItems="center"
        justifyContent="flex-end"
        padding="4px"
      >
        <Button
          variant="contained"
          color="success"
          style={{ marginRight: "10px" }}
          onClick={handleUpdate}
        >
          {type === "edit" ? "Update" : "Add"}
        </Button>
        <Button variant="contained" color="error" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
};

export default AddEditEntry;
