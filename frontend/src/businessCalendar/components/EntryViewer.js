import React, { useState, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  alpha,
  Container,
  Box,
  Typography,
  IconButton,
  GridLegacy,
  Modal,
  Button,
} from "@mui/material";
import {
  PlayCircleOutline,
  CheckCircleOutline,
  Edit,
  Person,
  Delete,
  Key,
} from "@mui/icons-material";
import { toast } from "react-toastify";
import ChangeCompletionStatus from "./ChangeCompletionStatus";
import FileDisplayDownload from "./FileDisplayDownload";
import Reassign from "./Reassign";
import DeleteModal from "./DeleteModal";
import AddEditEntry from "./AddEditEntry";
import AllOrOneModal from "./AllOrOneModal";
import ProgressModal from "./ProgressModal";
import KeyResultsModal from "./KeyResultsModal";

import { generateReminderOptions, getCategoryColour } from "./UtilityFunctions";
import {
  updateEntry,
  updateRecurringEntries,
} from "../features/calendar/calendarSlice";
import { boxSizing, maxWidth, minHeight, width } from "@mui/system";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  maxWidth: "60%",
  maxHeight: "80vh",
  overflowY: "auto",
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

const KeyResultsModalStyle = {
  ...modalStyle,
  width: {
    xs: "calc(100vw - 32px)",
    md: "75%",
    lg: "65%",
  },
  maxWidth: "1100px",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const EntryViewer = ({ entryData, type }) => {
  const {
    _id,
    category,
    title,
    startTime,
    endTime,
    priority,
    whenAlarm,
    completionStatus,
    progress = 0,
    description,
    userAssigned,
    userOwner,
    recurrence,
    createdAt,
    updatedAt,
    file,
    notes,
    objective,
    linkedObjective,
  } = entryData;

  const objectiveReference = linkedObjective || objective;

  const objectiveId = 
    objectiveReference?._id || objectiveReference || null;

  const isObjectiveEntry = 
    category === "OKR Objective" && Boolean(objectiveId);

  const objectives = useSelector(
    (state) => state.okr.objectives || []
  );

  const linkedObjectiveData = objectives.find(
    (obj) => String(obj._id || obj.id) === String(objectiveId)
  );
  
  const dispatch = useDispatch();

  console.log("Calendar Entry:", {
    title,
    category,
    objective,
    linkedObjective,
    objectiveId,
    isObjectiveEntry,
  });

  const { users } = useSelector((state) => state.auth);
  const emailList = users.map((user) => user.email);
  let reminder = null;
  if (whenAlarm) {
    reminder = generateReminderOptions(startTime, endTime, whenAlarm);
  }
  // New condition to set the expanded state permanently for "history" type
  const [expanded, setExpanded] = useState(type === "history" ? true : false);
  const entryRef = useRef(null);

  useEffect(() => {
    if (expanded && type !== "history") {
      entryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [expanded, type]);

  const [isDragging, setIsDragging] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [applyToSeries, setApplyToSeries] = useState(false);
  const startDateTime = new Date(startTime);
  const endDateTime = new Date(endTime);
  const createdDate = new Date(createdAt);
  const updatedDate = new Date(updatedAt);

  // Check if userOwner is in userAssigned and there is only one userAssigned and completionStatus is "not started"
  const isDeleteNotes = !(
    userAssigned.length === 1 &&
    userAssigned[0] === userOwner &&
    completionStatus === "not started"
  );
  const backgroundColor = getCategoryColour(category);
  // Objective status colours
  const objectiveStatusColours = {
      "not started": "#9ca3af",
      "on-track": "#72cdf4",
      "at-risk": "#f4b400",
      overdue: "#e57373",
      completed: "#00b085",
    };
  //Temporary status
  const objectiveStatus = linkedObjectiveData?.status;

  const statusColour = objectiveStatus
    ? objectiveStatusColours[objectiveStatus] || "#d9dfea" : "#d9dfea";

  const boxStyles = {
    width: "100%",
    minHeight: "130px",
    height: "fit-content",
    borderRadius: "12px",
    backgroundColor:
      entryData.completionStatus === "cancelled" ? "#A9A9A9" : isObjectiveEntry ? "#ffffff" : backgroundColor,
    padding: "20px 24px",
    display: "flex",
    borderLeft: `6px solid ${isObjectiveEntry ? statusColour : "#72cdf4"}`,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "12px",
    transition: "background-color 0.3s, cursor 0.3s",
    boxShadow:
      entryData.completionStatus === "overdue"
        ? "0px 0px 15px rgba(255, 0, 0, 0.55)"
        : "0px 2px 4px rgba(0, 0, 0, 0.4)",
  };
  const fontColour = isObjectiveEntry ? "#1f1e40" : "#ffffff";
  // Get priority color
  const priorityColor =
    priority.toLowerCase() === "high" ? "#ffcdd2" : "#00b085"; // Red for high, Green for normal

  // Icon Button click handlers
  const [openAllOrOne, setOpenAllOrOne] = useState({
    type: "", // "edit", "reassign", "delete"
    visible: false,
  });

  const [openCompletion, setOpenCompletion] = useState(false);
  const openAllOrOneModal = (actionType) => {
    setOpenAllOrOne({ type: actionType, visible: true });
  };

  const handleOpenComp = () => setOpenCompletion(true);
  const handleCloseComp = () => setOpenCompletion(false);

  const handleCompletionClick = () => {
    handleOpenComp();
  };

  const [openAssign, setOpenAssign] = useState(false);
  const handleOpenAssign = () => setOpenAssign(true);
  const handleCloseAssign = () => setOpenAssign(false);

  const handleAssignClick = () => {
    if (recurrence) {
      openAllOrOneModal("reassign");
    } else {
      handleOpenAssign();
    }
  };

  const [openEdit, setOpenEdit] = useState(false);
  const handleOpenEdit = () => setOpenEdit(true);
  const handleCloseEdit = () => setOpenEdit(false);

  const handleEditClick = () => {
    if (recurrence) {
      openAllOrOneModal("edit");
    } else {
      handleOpenEdit();
    }
  };

  const [openDel, setOpenDel] = useState(false);
  const handleOpenDel = () => setOpenDel(true);
  const handleCloseDel = () => setOpenDel(false);

  const handleDeleteClick = () => {
    if (recurrence) {
      openAllOrOneModal("delete");
    } else {
      handleOpenDel();
    }
  };

  const [openProgress, setOpenProgress] = useState(false);
  const handleOpenProgress = () => setOpenProgress(true);
  const handleCloseProgress = () => setOpenProgress(false);

  //Open Key Results
  const [openKeyResults, setOpenKeyResults] = useState(false);
  const handleOpenKeyResults = () => setOpenKeyResults(true);
  const handleCloseKeyResults = () => setOpenKeyResults(false);

  // All or one
  const handleJustThis = () => {
    setApplyToSeries(false);
    setOpenAllOrOne({ type: "", visible: false });

    // Proceed with the action based on the type
    if (openAllOrOne.type === "edit") handleOpenEdit();
    else if (openAllOrOne.type === "reassign") handleOpenAssign();
    else if (openAllOrOne.type === "delete") handleOpenDel();
  };

  const handleAllInSeries = () => {
    setApplyToSeries(true);
    // Works because current render cycle continues with the old state
    setOpenAllOrOne({ type: "", visible: false });

    // Proceed with the action based on the type
    if (openAllOrOne.type === "edit") handleOpenEdit();
    else if (openAllOrOne.type === "reassign") handleOpenAssign();
    else if (openAllOrOne.type === "delete") handleOpenDel();
  };

  const handleUpdateEntry = async (formData, dispatch) => {
    // Create a copy of the formData object
    const newFormData = { ...formData };

    // Transform priority to lowercase in the newFormData
    newFormData.priority = newFormData.priority.toLowerCase();

    // Create createdAt and updatedAt dates in the newFormData
    const currentDate = new Date();
    newFormData.updatedAt = currentDate.toISOString();

    // Assign lowercase value of recurrence to new field recurrence.freq
    newFormData.recurrence = {
      freq: newFormData.recurrence.toLowerCase(),
      until: newFormData.until,
    };

    try {
      let updatedEntry;

      if (applyToSeries) {
        // If applyToSeries is true, add type: "edit" and call updateRecurringEntries
        const entryData = {
          type: "edit",
          ...newFormData,
        };
        updatedEntry = await dispatch(
          updateRecurringEntries({ entryId: _id, entryData })
        );
      } else {
        // Otherwise, just call updateEntry with newFormData
        updatedEntry = await dispatch(
          updateEntry({ entryId: _id, entryData: newFormData })
        );
      }

      // Log the response data to the console
      toast.success("Entry updated");
      console.log("Entry updated", updatedEntry.payload);

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      // Handle any errors that occur during the request
      toast.error("Failed to update entry.", error);
      console.error("Error updating calendar entry:", error);
    }
  };

  return (
    <Container 
      ref={entryRef}
      maxWidth="xl" 
      style={{ 
        marginBottom: "5px",
        scrollMarginTop: "20px",
      }}
    >
      <Box
        sx={
          type !== "history"
            ? {
                ...boxStyles,
                cursor: "pointer",
                "&:hover": { bgcolor: isObjectiveEntry ? "#f8fafc" : alpha(backgroundColor, 0.8) },
              }
            : boxStyles
        }
        onMouseDown={(event) => {
          // Record the initial mouse position
          setMouseDownPos({ x: event.clientX, y: event.clientY });
          setIsDragging(false);
        }}
        onMouseMove={(event) => {
          // If mouse has moved more than a threshold, consider it a drag
          if (event.buttons === 1) {
            // Left mouse button is pressed
            const deltaX = Math.abs(event.clientX - mouseDownPos.x);
            const deltaY = Math.abs(event.clientY - mouseDownPos.y);
            if (deltaX > 5 || deltaY > 5) {
              setIsDragging(true);
            }
          }
        }}
        onClick={(event) => {
          event.stopPropagation();

          //Ignore clicks originating inside Material UI modal
          if (event.target.closest(".MuiModal-root")) {
            return;
          }

          // Don't toggle if user was dragging (selecting text)
          if (isDragging) {
            return;
          }

          // Don't toggle when Modals and buttons within are clicked
          if (
            !event.target.closest("button") &&
            !event.target.closest(".MuiBackdrop-root") &&
            !event.target.closest(".css-me3lt1") &&
            !event.target.closest(".css-12ep8dn") &&
            !event.target.closest(".css-i9fmh8")
          ) {
            // Toggle expanded state only if the type is not "history"
            if (type !== "history") {
              setExpanded(!expanded);
            }
          }
        }}
      >
        <GridLegacy
          container
          direction="column"
          justifyContent="flex-start"
          alignItems="flex-start"
        >
          {/* Top row */}
          <GridLegacy
            container
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            item
            xs={12}
          >
            {/* Left window */}
            <GridLegacy item xs={12} md={10} lg={10}>
              <GridLegacy
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="center"
                spacing={1}
              >
                {/* Date time box */}
                <GridLegacy
                  container
                  direction={"column"}
                  alignContent={"flex-start"}
                  justifyContent={"center"}
                  item
                  xs={12}
                  sm={4}
                  md={3}
                  lg={3}
                >
                  <GridLegacy 
                    item
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                    }}
                  >
                    {isObjectiveEntry && (
                      <Box
                        sx={{
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          backgroundColor: statusColour,
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <Typography
                      variant="h6"
                      sx={{
                        color: fontColour,
                        fontWeight: 600,
                          /*entryData.completionStatus === "overdue"
                            ? "yellow"
                            : fontColour,*/
                      }}
                    >
                      {category === "meeting" ? (
                        <>
                          {startDateTime.toLocaleTimeString([], {
                            hour12: true,
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" - "}
                          {endDateTime.toLocaleTimeString([], {
                            hour12: true,
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      ) : category === "event" ? (
                        startDateTime.toLocaleTimeString([], {
                          hour12: true,
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      ) : (
                        endDateTime.toLocaleTimeString([], {
                          hour12: true,
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      )}
                    </Typography>
                  </GridLegacy>

                  <GridLegacy item>
                    <Typography
                      variant="body"
                      sx={{
                        color: isObjectiveEntry ? "#64748B" : "rgba(255, 255, 255, 0.8)",
                          /*entryData.completionStatus === "overdue"
                            ? "yellow"
                            : fontColour,*/
                      }}
                    >
                      {category === "event"
                        ? startDateTime.toLocaleDateString("en-AU")
                        : endDateTime.toLocaleDateString("en-AU")}
                    </Typography>
                  </GridLegacy>
                </GridLegacy>

                {/* Title box */}
                <GridLegacy
                  container
                  direction={"column"}
                  alignContent={"flex-start"}
                  justifyContent={"center"}
                  item
                  xs={12}
                  sm={6}
                  md={5}
                  lg={5}
                >
                  <Box sx={{ flexGrow: 1 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        minWidth: 0,
                      }}
                    >

                      <Typography 
                        variant="h5" 
                        sx={{ 
                          color: fontColour,
                          fontWeight: 600,
                          fontSize: "26px",
                          lineHeight: 1.2,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {title}
                      </Typography>
                    </Box>
                  </Box>
                </GridLegacy>

                <GridLegacy item xs={12} sm={2} md={4} lg={4}>
                  {type !== "history" ? (
                    <div>
                      <Typography
                        variant="h6"
                        sx={{ 
                          color: fontColour,
                          fontWeight: 600, 
                        }}
                      >
                        Assigned to:
                      </Typography>
                      <Typography
                        variant="body"
                        sx={{ 
                          fontSize: "12px", 
                          color: isObjectiveEntry ? "#64748B" : "rgba(255, 255, 255, 0.8)",
                        }}
                      >
                        {userAssigned.map((user, index) => (
                          <React.Fragment key={index}>
                            {user}
                            <br />
                          </React.Fragment>
                        ))}
                      </Typography>
                    </div>
                  ) : null}
                </GridLegacy>
              </GridLegacy>
            </GridLegacy>
            {/* Right window */}
            {type !== "history" ? (
              <GridLegacy 
                item 
                xs={12}
                md={2}
                lg={2}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                {/* Icons box */}
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "4px",
                      }}
                    >
                    {!isObjectiveEntry && (
                      <>
                        <IconButton
                          title="Change completion status"
                          onClick={() => {
                            handleCompletionClick();
                          }}
                          sx={{
                            color: fontColour,
                            "&:hover": {
                            backgroundColor: "rgba(255, 255, 255, 0.15)",
                            },
                          }}
                        >
                        {completionStatus === "not started" ? (
                          <PlayCircleOutline />
                          ) : (
                          <CheckCircleOutline />
                        )}
                        </IconButton>
                        {/*Completion Status Modal */}
                        <div>
                          <Modal open={openCompletion} onClose={handleCloseComp}>
                            <Box sx={modalStyle}>
                              <ChangeCompletionStatus
                                status={completionStatus}
                                id={_id}
                                progress={progress}
                                onCancel={handleCloseComp}
                              />
                            </Box>
                          </Modal>
                        </div>
                      </>
                    )}

                    <IconButton
                      title="Edit"
                      onClick={() => {
                        handleEditClick();
                      }}
                      sx={{
                        color: fontColour,
                        "&:hover": {
                          backgroundColor: "rgba(255, 255, 255, 0.15)",
                        },
                      }}
                    >
                      <Edit />
                    </IconButton>
                    {/* Edit Entry Modal */}
                    <div>
                      <Modal open={openEdit} onClose={handleCloseEdit}>
                        <Box sx={modalStyle}>
                          <AddEditEntry
                            emailList={emailList}
                            onCancel={handleCloseEdit}
                            type={"edit"}
                            entryData={entryData}
                            handleAddNewEntry={handleUpdateEntry}
                          />
                        </Box>
                      </Modal>
                    </div>

                    <IconButton
                      title="Reassign"
                      onClick={() => {
                        handleAssignClick();
                      }}
                      sx={{
                        color: fontColour,
                        "&:hover": {
                          backgroundColor: "rgba(255, 255, 255, 0.15)",
                        },
                      }}
                    >
                      <Person />
                    </IconButton>
                    {/* Reassignment Modal */}
                    <div>
                      <Modal open={openAssign} onClose={handleCloseAssign}>
                        <Box sx={modalStyle}>
                          <Reassign
                            entryId={_id}
                            onCancel={handleCloseAssign}
                            emailList={emailList}
                            applyToSeries={applyToSeries}
                          />
                        </Box>
                      </Modal>
                    </div>

                    <IconButton
                      title="Delete"
                      onClick={() => {
                        handleDeleteClick();
                      }}
                      sx={{
                        color: fontColour,
                        "&:hover": {
                          color: "#ffcccc",
                          backgroundColor: "rgba(255, 0, 0, 0.15)",
                        },
                      }}
                    >
                      <Delete />
                    </IconButton>
                      {/* Delete Modal */}
                      <div>
                        <Modal open={openDel} onClose={handleCloseDel}>
                          <Box sx={modalStyle}>
                            <DeleteModal
                              entryId={_id}
                              onCancel={handleCloseDel}
                              isDeleteNotes={isDeleteNotes}
                              applyToSeries={applyToSeries}
                            />
                          </Box>
                        </Modal>
                      </div>
                      </Box>

                      <Box
                      sx={{
                        backgroundColor: priorityColor,
                        borderRadius: "12px",
                        padding: "2px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        marginTop: "4px",
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: "#ffffff",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        Priority: {priority.toUpperCase()}
                      </Typography>
                      </Box>

                      <Modal
                        open={openAllOrOne.visible}
                        onClose={() =>
                          setOpenAllOrOne({ type: "", visible: false })
                        }
                      >
                        <Box sx={modalStyle}>
                          <AllOrOneModal
                            type={openAllOrOne.type}
                            handleJustThis={handleJustThis}
                            handleAllInSeries={handleAllInSeries}
                          />
                        </Box>
                      </Modal>
                    </Box>
                  </GridLegacy>
              ) : null}
            </GridLegacy>

          {/* Bottom row */}
          <GridLegacy container item>
            {/* Description box */}
            {expanded && (
              <>
                <GridLegacy 
                  item 
                  xs={12}
                  sx={{
                    mt: 2,
                    pt: 2,
                    borderTop: isObjectiveEntry ? "1px solid #D9DFEA" : "1px solid rgba(255, 255, 255, 0.3)",
                  }}>
                  <Typography variant="subtitle2" sx={{ color: fontColour }}>
                    Category:{" "}
                    {category === "businessdeadline"
                      ? "Business Deadline"
                      : category.charAt(0).toUpperCase() + category.slice(1)}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ color: fontColour }}>
                    {startTime
                      ? `Start Time: ${startDateTime.toLocaleString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}; End Time: ${endDateTime.toLocaleString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}`
                      : `Due Time: ${endDateTime.toLocaleString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}`}
                  </Typography>

                  {type === "history" ? (
                    <div>
                      <Typography
                        variant="h6"
                        sx={{ fontSize: "14px", color: fontColour }}
                      >
                        Assigned to:
                      </Typography>
                      <Typography
                        variant="body"
                        sx={{ fontSize: "12px", color: fontColour }}
                      >
                        {userAssigned.map((user, index) => (
                          <React.Fragment key={index}>
                            {user}
                            <br />
                          </React.Fragment>
                        ))}
                      </Typography>
                    </div>
                  ) : null}
                  <Typography
                    variant="overline"
                    sx={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: fontColour,
                    }}
                  >
                    Status: {" "}
                    <Box
                      component="span"
                      sx={{
                        color: isObjectiveEntry ? statusColour : fontColour,
                        fontWeight: 800,
                        letterSpacing: "0.5px",
                      }}
                    >
                      {isObjectiveEntry
                        ? objectiveStatus
                          ? objectiveStatus
                          : "Loading..."
                        : completionStatus}
                    </Box>
                  </Typography>
                </GridLegacy>
                <GridLegacy item xs={12}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      backgroundColor: "rgba(255, 255, 255, 0.5)",
                      border: "2px solid #d9dfea",
                      borderRadius: "8px",
                      padding: "8px",
                      marginTop: "8px",
                    }}
                  >
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        color: isObjectiveEntry ? "#1F1E40" : "#000",
                        fontWeight: "bold",
                        marginBottom: "2px",
                      }}>
                      Description:
                    </Typography>
                    <Typography variant="body2" sx={{ color: isObjectiveEntry ? "#1F1E40" : "#000", }}>
                      {description}
                    </Typography>
                  </Box>
                </GridLegacy>
                <GridLegacy 
                  container
                  sx={{
                    mt: 1.5,
                  }}
                >
                  <GridLegacy item xs={6}>
                    <Typography variant="body2" sx={{ color: fontColour, mb: 0.5}}>
                      <strong>Created by:</strong> {userOwner}
                    </Typography>
                  </GridLegacy>
                  <GridLegacy item xs={6}>
                    <Typography variant="body2" sx={{ color: fontColour, mb: 0.5 }}>
                      <strong>Date created:</strong>{" "}
                      {createdDate.toLocaleDateString("en-AU")}
                    </Typography>
                  </GridLegacy>
                  <GridLegacy item xs={6}>
                    <Typography variant="body2" sx={{ color: fontColour }}>
                      <strong>Repeats:</strong>{" "}
                      {recurrence ? recurrence.displayRule : "None"}
                    </Typography>
                  </GridLegacy>
                  <GridLegacy item xs={6}>
                    <Typography variant="body2" sx={{ color: fontColour }}>
                      <strong>Last Updated:</strong>{" "}
                      {updatedDate.toLocaleString("en-AU")}
                    </Typography>
                  </GridLegacy>
                </GridLegacy>
                {whenAlarm ? (
                  <GridLegacy item xs={6}>
                    <Typography variant="body2" sx={{ color: fontColour }}>
                      <strong>Reminder:</strong> {reminder}
                    </Typography>
                  </GridLegacy>
                ) : null}
                {notes ? (
                  <GridLegacy item xs={12}>
                    <Typography variant="body2" sx={{ color: fontColour }}>
                      <strong>Notes:</strong> {notes}
                    </Typography>
                  </GridLegacy>
                ) : null}

                
                  <GridLegacy item xs={12} sx={{mt:1}}>
                    <Typography variant="body2" sx={{ color: fontColour }}>
                      Attachments:
                    </Typography>
                    {file && file.length > 0 ? (
                      <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        mt: 0.5,
                      }}
                    >
                      {file.map((id) => (
                        <FileDisplayDownload key={id} fileId={id} />
                      ))}
                    </Box>
                    ):(
                      <Typography
                        variant="body2"
                        sx={{
                          color: fontColour,
                          opacity: 0.8,
                        }}
                      >
                        None
                      </Typography>
                    )}
                  </GridLegacy>
                
                {type !== "history" ? (
                  <GridLegacy item xs={12}>
                    <Box
                      sx={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 1,
                          mt: 2,
                          pt: 1.5,
                          borderTop: isObjectiveEntry ? "1px solid #D9DFEA" : "1px solid rgba(255, 255, 255, 0.3)",
                      }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleOpenProgress}
                      sx={{
                        color: "#ffffff",
                        borderColor: "#1f1e40",
                        "&:hover": {
                          borderColor: "#1f1e40",
                          backgroundColor: "1f1e40",
                        }
                      }}
                    >
                      View Progress
                    </Button>
                  {isObjectiveEntry && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleOpenKeyResults}
                      sx={{
                        backgroundColor: "#00b085",
                        color: "#ffffff",
                        "&:hover": {
                          borderColor: "#1f1e40",
                          backgroundColor: "#009973",
                        }
                      }}
                    >
                      View Key Results
                    </Button>
                  )}
                    
                    </Box>

                    <Modal open={openProgress} onClose={handleCloseProgress}>
                      <Box sx={modalStyle}>
                        <ProgressModal
                          _id={_id}
                          users={users}
                          handleClose={handleCloseProgress}
                        />
                      </Box>
                    </Modal>

                    <Modal
                      open={openKeyResults && isObjectiveEntry}
                      onClose={handleCloseKeyResults}
                    >
                      <Box
                        sx={KeyResultsModalStyle}
                      >
                        <KeyResultsModal
                          objectiveId={objectiveId}
                          //entryId={_id}
                          objectiveTitle={title}
                          handleClose={handleCloseKeyResults}
                        />
                      </Box>
                    </Modal>
                  </GridLegacy>
                ) : null}
              </>
            )}
          </GridLegacy>
        </GridLegacy>
      </Box>
    </Container>
  );
};
export default EntryViewer;
