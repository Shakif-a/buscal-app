import React, { useState } from "react";
import { Box, alpha, Modal } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AddEditEntry from "./AddEditEntry";

const ButtonAddEntry = ({
  height = "50px",
  color = "#ffffff",
  emailList,
  handleAddNewEntry,
}) => {
  const fontSize = `calc(${height} / 2.2)`;
  const isDarkColor = isDarkBackground(color);
  const fontColor = isDarkColor ? "#ffffff" : "#000000";

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

  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          borderRadius: "10px",
          backgroundColor: color,
          width: "fit-content",
          height: height,
          padding: "10px",
          color: fontColor,
          "&:hover": { bgcolor: alpha(color, 0.8) },
          boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.3)",
          cursor: "pointer",
        }}
        onClick={handleOpen}
      >
        <AddIcon style={{ fontSize: fontSize, marginRight: "10px" }} />

        <span style={{ fontSize: fontSize }}>Add Entry</span>
      </Box>
      <div>
        <Modal open={open} onClose={handleClose}>
          <Box sx={modalStyle}>
            <AddEditEntry
              handleAddNewEntry={handleAddNewEntry}
              emailList={emailList}
              onCancel={handleClose}
            />
          </Box>
        </Modal>
      </div>
    </>
  );
};

const isDarkBackground = (color) => {
  let rgbValues;

  // Check if the colour is a hexadecimal value
  if (color.startsWith("#")) {
    // Convert hexadecimal to RGB
    rgbValues = [
      parseInt(color.substring(1, 3), 16),
      parseInt(color.substring(3, 5), 16),
      parseInt(color.substring(5, 7), 16),
    ];
  } else {
    // Assume the colour is an RGB string and extract RGB values
    const rgb = color.substring(4, color.length - 1);
    rgbValues = rgb.split(",").map((value) => parseInt(value));
  }

  // Calculate luminance
  const luminance =
    (0.299 * rgbValues[0] + 0.587 * rgbValues[1] + 0.114 * rgbValues[2]) / 255;

  return luminance < 0.5; // Return true if it's a dark colour
};

export default ButtonAddEntry;
