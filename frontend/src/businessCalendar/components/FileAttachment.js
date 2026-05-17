import React, { useState } from "react";
import { TextField, Box } from "@mui/material";
import UploadHandler from "./UploadHandler";

function FileAttachment({
  placeholder,
  onDescriptionChange,
  getFileID,
  givenDesc,
}) {
  const [description, setDescription] = useState(givenDesc || "");

  const handleDescriptionChange = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const { value } = event.target;
    setDescription(value);
    if (typeof onDescriptionChange === "function") onDescriptionChange(value); // Call the callback function to update formData.description
  };

  return (
    <Box position="relative">
      <TextField
        fullWidth
        multiline
        rows={5}
        variant="filled"
        placeholder={placeholder}
        value={description}
        onChange={handleDescriptionChange}
      />
      <Box display={"flex"} justifyContent={"flex-start"} marginTop={2}>
        <UploadHandler getFileID={getFileID} />
      </Box>
    </Box>
  );
}

export default FileAttachment;
