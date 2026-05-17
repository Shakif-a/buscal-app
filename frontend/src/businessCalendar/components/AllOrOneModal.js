import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

const AllOrOneModal = ({ type, handleJustThis, handleAllInSeries }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        This is a recurring entry.
      </Typography>
      <Typography variant="body2" gutterBottom>
        Do you want to {type} just this entry or all entries in the series?
      </Typography>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 2,
          width: "100%",
        }}
      >
        <Button
          variant="contained"
          onClick={handleJustThis}
          sx={{ marginRight: "10px" }}
        >
          Just This
        </Button>
        <Button variant="outlined" onClick={handleAllInSeries}>
          All in Series
        </Button>
      </Box>
    </Box>
  );
};

export default AllOrOneModal;
