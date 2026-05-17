import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import VerticalTimeline from "./history/VerticalTimeline";
import { getHistoryById } from "../features/calendar/calendarSlice";
import {
  transformHistoriesToTimeline,
  replaceIdwithName,
} from "./history/DetailViewCard";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const ProgressModal = ({ _id, users, handleClose }) => {
  const dispatch = useDispatch();
  const { calendarHistory } = useSelector((state) => state.calendar);

  useEffect(() => {
    dispatch(getHistoryById(_id));
  }, [dispatch, _id]);

  // Add a conditional check to ensure `calendarHistory` exists
  if (!calendarHistory || calendarHistory.length === 0) {
    return <p>Loading...</p>;
  }

  const timeline = transformHistoriesToTimeline(calendarHistory);
  const replacedTimeline = replaceIdwithName(timeline, users);

  return (
    <div style={{ width: "600px", position: "relative" }}>
      {/* Close button in the top-right corner */}
      <IconButton
        onClick={handleClose}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          zIndex: 1, // Ensure it stays on top
        }}
      >
        <CloseIcon />
      </IconButton>

      <VerticalTimeline data={replacedTimeline} />
    </div>
  );
};

export default ProgressModal;
