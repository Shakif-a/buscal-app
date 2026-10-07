import React, {useState} from "react";
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
    entryId,
    objectiveTitle,
    handleClose,
}) => {
    const [expandedKeyResult, setExpandedKeyResult] = useState(null);

    const[keyResults, setKeyResults] = useState([
        {
            id: 1,
            title: "Key Result 1",
            dueDate: "20/10/26",
            weight: 30,
            assigned: "Employee Name",
            progress: 50,
            status: "on-track",
            approval: "Pending",
        },
        {
            id: 2,
            title: "Key Result 2",
            dueDate: "24/10/26",
            weight: 40,
            assigned: "Employee Name",
            progress: 75,
            status: "on-track",
            approval: "Pending",
        },
        {
            id: 3,
            title: "Key Result 3",
            dueDate: "28/10/26",
            weight: 30,
            assigned: "Employee Name",
            progress: 40,
            status: "on-track",
            approval: "Pending",
        },
    ]);

    const updateKeyResults = (id, field, value) => {
        setKeyResults((previousKeyResults) =>
        previousKeyResults.map((keyResult) =>
            keyResult.id === id
        ? {
            ...keyResult,
            [field]: value,
        }
        : keyResult
        )
        );
    };


    const handleSave = (keyResult) => {
        console.log("Saving Key Result:", keyResult);
        //Backend update here
        setExpandedKeyResult(null);
        };

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
                    {keyResult.progress}%
                  </Typography>

                  <Typography variant="body2">
                    <strong>Due:</strong>{" "}
                    {keyResult.dueDate}
                  </Typography>

                  <Typography variant="body2">
                    <strong>Status:</strong>{" "}
                    {keyResult.status}
                  </Typography>

                  <Typography variant="body2">
                    <strong>Approval:</strong>{" "}
                    {keyResult.approval}
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

                    <Typography sx={{ fontWeight: 600 }}>
                      {keyResult.progress}%
                    </Typography>

                     </Box>

                      <Slider
                        value={keyResult.progress}
                        min={0}
                        max={100}
                        onChange={(event, newValue) =>
                          updateKeyResult(
                            keyResult.id,
                            "progress",
                            newValue
                          )
                        }
                      />
                 
                </Box>

                <Box
                sx={{
                  display: "flex",
                  gap: 4,
                  mt: 2,
                  alignItems: "flex-start",
                }}
                >

                {/* Status */}
                <Box sx={{ flex: 1}}>
                  <Typography sx={{ mb: 1 }}>
                    <strong>Status</strong>
                  </Typography>

                  <FormControl
                    size="small"
                    sx= {{width: 200}}
                  >
                    <Select
                      value={keyResult.status}
                      onChange={(event) =>
                        updateKeyResult(
                          keyResult.id,
                          "status",
                          event.target.value
                        )
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
                <Box
                sx={{
                  flex:1,
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
                    onClick={() =>
                      setExpandedKeyResult(null)
                    }
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="contained"
                    size="small"
                    onClick={() =>
                      handleSave(keyResult)
                    }
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    setExpandedKeyResult(
                      keyResult.id
                    )
                  }
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