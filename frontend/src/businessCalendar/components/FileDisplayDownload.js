import React, { useEffect, useState } from "react";
import { Typography, Box, ButtonBase } from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";
import DescriptionIcon from "@mui/icons-material/Description";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import calendarService from "../features/calendar/calendarService";

const FileDisplayDownload = ({ fileId }) => {
  const [fileInfo, setFileInfo] = useState(null);

  const getFileIcon = (mimetype) => {
    switch (mimetype) {
      case "image/png":
      case "image/jpeg":
      case "image/gif":
        return <ImageIcon fontSize="small" />;
      case "application/pdf":
        return <DescriptionIcon fontSize="small" />;
      default:
        return <InsertDriveFileIcon fontSize="small" />;
    }
  };

  const getFileExtension = (filename) => {
    if (!filename) return "FILE";
    const parts = filename.split(".");
    return parts.length > 1 ? parts.pop().toUpperCase() : "FILE";
  };

  const fetchFileData = async () => {
    try {
      if (fileId) {
        const fileData = await calendarService.getFileDetailsById(fileId);
        setFileInfo(fileData);
      }
    } catch (error) {
      console.error("Error fetching file data:", error);
    }
  };

  useEffect(() => {
    fetchFileData();
  }, [fileId]);

  return (
    <ButtonBase
      onClick={() => calendarService.handleDownload(fileId)}
      disabled={!fileInfo}
      sx={{
        width: "100%",
        justifyContent: "flex-start",
        textAlign: "left",
        "&:hover": {
          backgroundColor: "rgba(255, 255, 255, 0.7)",
        },
      }}
    >
      <Box
        sx={{
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          padding: "8px",
          width: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          minHeight: "50px",
          borderRadius: "4px",
        }}
      >
        {/* File extension box on the left */}
        <Box
          sx={{
            backgroundColor: "#424242",
            color: "#fff",
            width: "50px",
            height: "50px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            flexShrink: 0,
          }}
        >
          {fileInfo ? (
            <>
              {getFileIcon(fileInfo.mimetype)}
              <Typography
                variant="caption"
                sx={{
                  fontSize: "9px",
                  fontWeight: "bold",
                  marginTop: "2px",
                }}
              >
                {getFileExtension(fileInfo.filename)}
              </Typography>
            </>
          ) : (
            <Typography variant="caption" sx={{ fontSize: "9px" }}>
              ...
            </Typography>
          )}
        </Box>

        {/* Filename text on the right */}
        <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
          {fileInfo ? (
            <Typography
              variant="body2"
              sx={{
                color: "#000",
                wordBreak: "break-word",
              }}
            >
              {fileInfo.filename}
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: "#666" }}>
              Loading...
            </Typography>
          )}
        </Box>
      </Box>
    </ButtonBase>
  );
};

export default FileDisplayDownload;
