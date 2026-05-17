import React, { useState } from "react";
import { Button, Box } from "@mui/material";
import calendarService from "../features/calendar/calendarService";

const UploadHandler = ({ getFileID }) => {
  const [files, setFiles] = useState([]);
  const [fileIds, setFileIds] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("default");

  const handleFileChange = async (e) => {
    const selectedFiles = [...e.target.files];
    setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
    setUploadStatus("default");

    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("files", selectedFiles[i]);
    }

    try {
      const newFileIds = await calendarService.uploadFiles(formData);
      console.log("File IDs:", newFileIds);

      // Append new fileIds to the existing fileIds state
      setFileIds((prevFileIds) => [...prevFileIds, ...newFileIds]);

      // Pass all accumulated fileIds to the parent if needed
      if (typeof getFileID === "function") {
        getFileID([...fileIds, ...newFileIds]);
      }
      setUploadStatus("success");
    } catch (error) {
      alert("Error uploading files");
      console.error("Error occurred:", error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = [...e.dataTransfer.files];
    setFiles((prevFiles) => [...prevFiles, ...droppedFiles]);

    const formData = new FormData();
    for (let i = 0; i < droppedFiles.length; i++) {
      formData.append("files", droppedFiles[i]);
    }

    calendarService
      .uploadFiles(formData)
      .then((newFileIds) => {
        console.log("File IDs:", newFileIds);

        // Append new fileIds to the existing fileIds state
        setFileIds((prevFileIds) => [...prevFileIds, ...newFileIds]);

        // Pass all accumulated fileIds to the parent if needed
        if (typeof getFileID === "function") {
          getFileID([...fileIds, ...newFileIds]);
        }
        setUploadStatus("success");
      })
      .catch((error) => {
        alert("Error uploading files");
        console.error("Error occurred:", error);
      });
  };

  return (
    <Box
      sx={{
        padding: "10px",
        border: "2px dashed grey",
        borderRadius: "10px",
        textAlign: "center",
        position: "relative",
        marginTop: "20px",
        cursor: "pointer",
        backgroundColor: "transparent",
        opacity: 1,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        id="files"
        type="file"
        multiple
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <label htmlFor="files">
        <Button component="span" variant="contained">
          Upload Files
        </Button>
      </label>
      <p
        style={{
          fontSize: "0.8rem",
          color: "green",
          marginTop: "10px",
        }}
      >
        {uploadStatus === "success" &&
          `${files
            .map((file) => file.name)
            .join(", ")} has been uploaded successfully to the database`}
      </p>
      <p style={{ fontSize: "0.8rem", color: "grey", marginTop: "10px" }}>
        Drag & drop or click button to upload more files
      </p>
    </Box>
  );
};

export default UploadHandler;
