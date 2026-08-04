import React, { useState } from "react";
import { Box, alpha, Modal, TextField, Button, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

const ButtonAddObjective = ({
  height = "50px",
  color = "#ffffff",
  emailList,
  ButtonAddObjective,
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

        <span style={{ fontSize: fontSize }}>Add Objective</span>
      </Box>
      <div>
        <Modal open={open} onClose={handleClose}>
          <Box sx={modalStyle}>
            <AddEditObjective
              handleAddNewEntry={handleAddNewObjective}
              emailList={emailList}
              onCancel={handleClose}
            />
          </Box>
        </Modal>
      </div>
    </>
  );
};