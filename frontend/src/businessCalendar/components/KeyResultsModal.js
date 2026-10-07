import React, {useEffect, useState} from "react";
import { useDispatch, useSelector } from "react-redux";
import { getKeyResults, updateKeyResult, } from "../../okrTracker/features/objectives/objectiveSlice";
import {Box, 
    Typography, 
    Button, 
    IconButton, 
    Slider, 
    Select, 
    MenuItem, 
    FormControl, 
    Divider,
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
        //console.log("Saving Key Result:", keyResult);
        //Backend update here
        if (!editedKeyResult) return;
        const keyResultId = editedKeyResult._id || editedKeyResult.id

        try{
          await dispatch(
            updateKeyResult({
              objectiveId,
              keyResultId,
              keyResultData: {
                progress: editedKeyResult.progress,
                status: editedKeyResult.status,
              },
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
      if (!status) return "";
      const statusLabels = {
        "on-track" : "On Track",
        "at-risk" : "At Risk",
        "overdue" : "Overdue",
        "completed" : "Completed",
      };

      return statusLabels[status] || status;
    }

    return (
        <Box
            sx={{
                width: "650px",
                maxWidth: "90vw",
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
                    expandedKeyResult === keyResult.id;
            
            return (
                <Box
                key={keyResult.id}
                sx={{
                    border: "1px solid #d9dfea",
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
                    gap: 3,
                }}
                >
                    <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: "bold" }}
                    >
                        {keyResult.title}
                    </Typography>

                    <Typography variant="body2">
                    <strong>Assigned:</strong> {keyResult.assigned}
                    </Typography>
                    </Box>

                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 3,
                    mt: 1,
                  }}
                >
                  <Typography variant="body2">
                    <strong>Weight:</strong>{" "}
                    {keyResult.weight}%
                  </Typography>

                  <Typography variant="body2">
                    <strong>Progress:</strong>{" "}
                    {editedKeyResult?.progress ?? keyResult.progress}%
                  </Typography>

                  <Typography variant="body2">
                    <strong>Due:</strong>{" "}
                    {formatDate(keyResult.dueDate)}
                  </Typography>

                  <Typography variant="body2">
                    <strong>Status:</strong>{" "}
                    {formatStatus(keyResult.status)}
                  </Typography>

                  <Typography variant="body2">
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

                    <Typography sx={{fontWeight: 600}}>
                      {editedKeyResult?.progress ?? keyResult.progress}%
                    </Typography>
                  </Box>
                    <Slider
                      value={editedKeyResult?.progress ?? 0}
                      min={0}
                      max={100}
                      onChange={(event, newValue) =>
                        setEditedKeyResult((previous) =>({
                          ...previous,
                          progress: newValue,
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
                        value={editedKeyResult?.status ?? "on-track"}
                        onChange={(event) =>
                          setEditedKeyResult((previous) =>({
                            ...previous,
                            status: event.target.value,
                          }))
                        }
                      >
                        <MenuItem value="on-track">
                          On Track
                        </MenuItem>

                        <MenuItem value="at-risk">
                          At Risk
                        </MenuItem>

                        <MenuItem value="overdue">
                          Overdue
                        </MenuItem>

                        <MenuItem value="completed">
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
                    setExpandedKeyResult(keyResult.id);
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