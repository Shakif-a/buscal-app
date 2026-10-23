import React, {useEffect, useState} from "react";
import { useDispatch, useSelector } from "react-redux";
import { getKeyResults, updateKeyResult, } from "../../okrTracker/features/objectives/objectiveSlice";
import {
    Box, 
    Typography, 
    Button, 
    IconButton, 
    Slider, 
    Select, 
    MenuItem, 
    FormControl, 
    Divider,
    TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const KeyResultsModal = ({
    objectiveId,
    objectiveTitle,
    handleClose,
}) => {
    const [expandedKeyResult, setExpandedKeyResult] = useState(null);
    const [editedKeyResult, setEditedKeyResult] = useState(null);

    const dispatch = useDispatch();

    const {
      keyResults,
      isLoading,
      isError,
      message,
    } = useSelector((state) => state.okr);

    console.log("KEY RESULTS FROM REDUX:", keyResults);
    console.log("KR LOADING:", isLoading);
    console.log("KR ERROR:", isError);
    console.log("KR MESSAGE:", message);

    console.log("Objective ID received by KeyResultsModal:", objectiveId);

    useEffect(() => {
      if (objectiveId) {
        dispatch(getKeyResults(objectiveId));
      }
    }, [dispatch, objectiveId]);

    const handleSave = async () => {
        //Backend update here
        if (!editedKeyResult) return;
        const keyResultId = editedKeyResult._id || editedKeyResult.id
        const original = keyResults.find(
          (kr) => String(kr._id || kr.id) === String(keyResultId)
        );
        if (!original) return;

        const keyResultData = {};

        if (Number(editedKeyResult.progress) !== Number(original.progress)) {
          keyResultData.progress = Number(editedKeyResult.progress);
        }

        if (editedKeyResult.status !== original.status) {
          keyResultData.status = editedKeyResult.status;
        }

        if (Object.keys(keyResultData).length === 0) {
          setExpandedKeyResult(null);
          setEditedKeyResult(null);
          return;
        }

        try{
          await dispatch(
            updateKeyResult({
              objectiveId,
              keyResultId,
              keyResultData,
            })
          ).unwrap();
          //reload Key Results from backend
          await dispatch(getKeyResults(objectiveId)).unwrap();
          
          setExpandedKeyResult(null);
          setEditedKeyResult(null);
        } catch (error) {
          console.error("Failed to update Key Result: ", error);
        }
        
    };
    //formatting date dd/mm/yy
    const formatDate = (date) => {
      if (!date) return "";
      return new Date(date).toLocaleDateString("en-AU");
    };

    //formatting status
    const formatStatus = (status) => {
      const statusLabels = {
        "in-progress" : "In Progress",
        "at-risk" : "At Risk",
        "overdue" : "Overdue",
        "awaiting-approval": "Awaiting Approval",
        "completed" : "Completed",
      };

      return statusLabels[status] || "Choose Progress";
    }

    const statusColours = {
      "in-progress": "#72cdf4",
      "at-risk": "#f4b400",
      overdue: "#e57373",
      "awaiting-approval": "#1f1e40",
      completed: "#00b085",
    };

    const statusBackgroundColours = {
      "in-progress": "#b6e3f8",
      "at-risk": "#ffe29a",
      overdue: "#f4a6a6",
      "awaiting-approval": "#82829d",
      completed: "#a5dfc9",
    };

    return (
        <Box
            sx={{
                width: "100%",
                boxSizing: "border-box",
                //maxWidth: "90vw",
            }}>
            <Box sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                
                <Typography variant="h5">
                    {objectiveTitle} - Key Results
                </Typography>

                <IconButton onClick={handleClose}>
                    <CloseIcon/>
                </IconButton>
            </Box>

            <Divider sx={{ my:2 }}/>

            {/*Key Results */}
            {keyResults.map((keyResult, index) =>{
                const isExpanded =
                    expandedKeyResult === (keyResult._id || keyResult.id);
            
            return (
                <Box
                key={keyResult._id || keyResult.id}
                sx={{
                    border: "1px solid #d9dfea",
                    borderLeftWidth: "6px",
                    borderLeftStyle: "solid",
                    borderLeftColor:
                      statusColours[keyResult.status?.trim().toLowerCase()] || "#72CDF4",
                    borderRadius: "12px",
                    padding: 2,
                    backgroundColor: "#fafafa",
                    mb: 2,
                }}>
                {/*Compacted KR*/} 
                <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 2,
                }}>
                
                <Box
                sx={{ flex:1 }}>
                    
                 <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    columnGap: 3,
                    rowGap: 0.5,
                    minWidth: 0,
                }}
                >
                    <Typography
                        variant="subtitle1"
                        sx={{ 
                          fontWeight: "bold",
                          overflowWrap: "anywhere",
                          minWidth: 0,
                        }}
                    >
                        {keyResult.title}
                    </Typography>

                    <Typography 
                      variant="body2"
                      sx={{
                        flexShrink: 0,
                      }}
                    >
                    <strong>Assigned:</strong> {keyResult.assigned}
                    </Typography>
                    </Box>

                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    columnGap: 2,
                    rowGap: 1.5,
                    mt: 1,
                    width: "100%",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "nowrap"
                    }}
                  >
                    <strong>Weight:</strong>{" "}
                    {keyResult.weight}%
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "nowrap"
                    }}
                  >
                    <strong>Progress:</strong>{" "}
                    {isExpanded
                      ? editedKeyResult?.progress ?? keyResult.progress
                      : keyResult.progress
                    }%
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "nowrap"
                    }}
                  >
                    <strong>Due:</strong>{" "}
                    {formatDate(keyResult.dueDate)}
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "nowrap"
                    }}
                  >
                    <strong>Status:</strong>{" "}
                    <Box
                      component="span"
                      sx={{
                        color: statusColours[keyResult.status] || "666",
                        fontWeight: 600,
                      }}
                    >
                      {formatStatus(keyResult.status)}
                    </Box>
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: "nowrap"
                    }}
                  >
                    <strong>Approval:</strong>{" "}
                    {keyResult.approved ? "Approved" : "Pending"}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Expanded edit section */}
            {isExpanded && (
              <>
                <Divider sx={{ my: 2 }} />

                {/* Progress */}
                <Box sx={{ mt: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <Typography>
                      <strong>Progress</strong>
                    </Typography>

                    <Box sx={{display: "flex", alignItems: "center", gap: 0.5}}>
                      <TextField
                        type="number"
                        size="small"
                        value={editedKeyResult?.progress ?? 0}
                        onChange={(event) => {
                          const value = event.target.value;

                          if (value === "") {
                            setEditedKeyResult((previous) => ({
                              ...previous,
                              progress: 0,
                            }));
                            return;
                          }

                          const number = Math.min(100, Math.max(0, Number(value)));

                          setEditedKeyResult((previous) => ({
                            ...previous,
                            progress: number,
                            status:
                              number !== 100 && previous.status === "awaiting-approval"
                                ? "in-progress"
                                : previous.status,
                          }));
                        }}

                        slotProps={{
                          htmlInput: {
                            min: 0,
                            max: 100,
                            step: 1,
                          },
                        }}

                        sx={{
                          width: "85px",
                          "& input" : {
                            textAlign: "right",
                            fontWeight: 600,
                          },
                        }}
                      />
                      <Typography sx={{fontWeight: 600}}>
                        %
                      </Typography>
                    </Box>
                  </Box>
                    <Slider
                      value={editedKeyResult?.progress ?? 0}
                      min={0}
                      max={100}
                      step={1}
                      onPointerDown={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event, newValue) =>
                        setEditedKeyResult((previous) =>({
                          ...previous,
                          progress: newValue,
                          status:
                              newValue !== 100 && previous.status === "awaiting-approval"
                                ? "in-progress"
                                : previous.status,
                        }))
                      }
                    />
                </Box>
                <Box
                  sx={{
                    display: "flex",
                    gap: 4,
                    mt: 2,
                    alignItems: "stretch",
                  }}
                >
                  {/* Status */}
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ mb: 1 }}>
                      <strong>Status</strong>
                    </Typography>

                    <FormControl
                      size="small"
                      fullWidth
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <Select
                        value={editedKeyResult?.status ?? ""}
                        displayEmpty
                        disabled={!(editedKeyResult?.canEdit || editedKeyResult?.canEditProgress)}
                        onChange={(event) =>
                          setEditedKeyResult((previous) =>({
                            ...previous,
                            status: event.target.value,
                          }))
                        }
                        sx= {{
                          backgroundColor:
                            statusBackgroundColours[editedKeyResult?.status] || "#ffffff",
                          color: "#1f1e40",
                          borderRadius: "8px",
                          fontWeight: 500,

                          "& .MuiSelect-select": {
                            padding: "10px 14px",
                          },

                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "1f1e40",
                          },

                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: "#1f1e40",
                          },
                        }}
                      >
                        <MenuItem value="" disabled>
                          Choose Progress
                        </MenuItem>

                        <MenuItem value="in-progress" disabled={!editedKeyResult?.canEdit}>
                          In Progress
                        </MenuItem>

                        <MenuItem value="at-risk" disabled={!editedKeyResult?.canEdit}>
                          At Risk
                        </MenuItem>

                        <MenuItem value="overdue" disabled={!editedKeyResult?.canEdit}>
                          Overdue
                        </MenuItem>

                        <MenuItem 
                          value="awaiting-approval"
                          disabled={
                            Number(editedKeyResult?.progress) !== 100 ||
                            editedKeyResult?.approved ||
                            !(editedKeyResult?.canEdit || editedKeyResult?.canEditProgress)
                          }
                        >
                          Awaiting Approval
                        </MenuItem>

                        <MenuItem 
                          value="completed"
                          disabled={
                            !editedKeyResult?.canEdit || !editedKeyResult?.approved
                          }
                        >
                          Completed
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Evidence */}
                  <Box sx={{
                      flex: 1,
                      borderLeft: "1px solid #d9dfea",
                      pl: 4,
                    }}>
                    <Typography sx={{ mb: 1 }}>
                      <strong>Evidence</strong>
                    </Typography>

                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                      }}
                    >
                      <Button variant="outlined">
                       View
                      </Button>

                      <Button
                        variant="outlined"
                        component="label"
                      >
                        Upload

                        <input
                          type="file"
                          hidden
                        />
                      </Button>
                    </Box>
                  </Box>
                </Box>

                
              </>
            )}

            {/* Bottom-right buttons */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 1,
                mt: 2,
              }}
            >
              {isExpanded ? (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setExpandedKeyResult(null);
                      setEditedKeyResult(null);
                    }}
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setExpandedKeyResult(keyResult._id || keyResult.id);
                    setEditedKeyResult({...keyResult});
                  }}
                >
                  Edit Key Result
                </Button>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Popup Close */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 2,
        }}
      >
        <Button
          variant="outlined"
          onClick={handleClose}
        >
          Close
        </Button>
      </Box>
    </Box>
  );
};

export default KeyResultsModal;