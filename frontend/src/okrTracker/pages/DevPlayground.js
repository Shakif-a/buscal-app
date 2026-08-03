import React, { useState } from "react";
import axios from "axios";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";

// Test page for the OKR API. Log in as a manager before using the buttons.
// Uses the OKR API url, not VITE_API_URL, which points at the deployed site.
const API_BASE = import.meta.env.VITE_OKR_API_URL || "http://localhost:5000";

// Keeps an id in sessionStorage so a page reload does not lose it.
function usePersistedId(key) {
  const [value, setValue] = useState(() => sessionStorage.getItem(key) || null);
  const setAndStore = (next) => {
    setValue(next);
    if (next) sessionStorage.setItem(key, next);
    else sessionStorage.removeItem(key);
  };
  return [value, setAndStore];
}

export default function DevPlayground() {
  const [log, setLog] = useState("Click a button to run a real API call.");
  const [objectiveId, setObjectiveId] = usePersistedId("devPlaygroundObjectiveId");
  const [keyResultId, setKeyResultId] = usePersistedId("devPlaygroundKeyResultId");
  const [calendarEntryId, setCalendarEntryId] = usePersistedId("devPlaygroundCalendarEntryId");

  const getToken = () => {
    const stored = localStorage.getItem("user");
    if (!stored) return null;
    try {
      return JSON.parse(stored).token || null;
    } catch (_error) {
      return null;
    }
  };

  const authHeaders = () => {
    const token = getToken();
    if (!token) {
      throw new Error("No logged-in user found in this browser. Log in first.");
    }
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const show = (label, data) => {
    setLog(`${label}\n\n${JSON.stringify(data, null, 2)}`);
  };

  const showError = (label, error) => {
    const detail = error.response?.data || error.message;
    setLog(`${label} FAILED\n\n${JSON.stringify(detail, null, 2)}`);
  };

  // Objective create, edit and delete.
  const createObjective = async () => {
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const response = await axios.post(
        `${API_BASE}/api/okr/objectives`,
        { title: "Dev Playground test objective", dueDate: dueDate.toISOString() },
        authHeaders()
      );
      setObjectiveId(response.data._id);
      show("Create Objective", response.data);
    } catch (error) {
      showError("Create Objective", error);
    }
  };

  const editObjective = async () => {
    if (!objectiveId) {
      setLog("Create an objective first, there's nothing to edit yet.");
      return;
    }
    try {
      const response = await axios.put(
        `${API_BASE}/api/okr/objectives/${objectiveId}`,
        { title: "Dev Playground test objective (edited)" },
        authHeaders()
      );
      show("Edit Objective", response.data);
    } catch (error) {
      showError("Edit Objective", error);
    }
  };

  const deleteObjective = async () => {
    if (!objectiveId) {
      setLog("Create an objective first, there's nothing to delete yet.");
      return;
    }
    try {
      const response = await axios.delete(
        `${API_BASE}/api/okr/objectives/${objectiveId}`,
        authHeaders()
      );
      show("Delete Objective", response.data);
      setObjectiveId(null);
      setKeyResultId(null);
    } catch (error) {
      showError("Delete Objective", error);
    }
  };

  // A key result, needed before the calendar link can be tested.
  const createKeyResult = async () => {
    if (!objectiveId) {
      setLog("Create an objective first, a key result needs one to belong to.");
      return;
    }
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const response = await axios.post(
        `${API_BASE}/api/okr/objectives/${objectiveId}/key-results`,
        { title: "Dev Playground test key result", weight: 100, dueDate: dueDate.toISOString() },
        authHeaders()
      );
      setKeyResultId(response.data._id);
      show("Create Key Result", response.data);
    } catch (error) {
      showError("Create Key Result", error);
    }
  };

  // Calendar entry, then linking it to the key result.
  const createCalendarEntry = async () => {
    try {
      const start = new Date();
      const end = new Date();
      end.setHours(end.getHours() + 1);
      const config = authHeaders();
      // userAssigned needs a user id, so use the logged-in user.
      const meResponse = await axios.get(`${API_BASE}/api/users/me`, config);
      const response = await axios.post(
        `${API_BASE}/api/calendar/entries`,
        {
          title: "Dev Playground test calendar entry",
          userAssigned: meResponse.data._id,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
        config
      );
      setCalendarEntryId(response.data.entry._id);
      show("Create Calendar Entry", response.data);
    } catch (error) {
      showError("Create Calendar Entry", error);
    }
  };

  const linkCalendarToKeyResult = async () => {
    if (!keyResultId || !calendarEntryId) {
      setLog("Need both a key result and a calendar entry first, run those two buttons above.");
      return;
    }
    try {
      const response = await axios.post(
        `${API_BASE}/api/okr/key-results/${keyResultId}/calendar-links`,
        { entryIds: [calendarEntryId] },
        authHeaders()
      );
      show("Link Calendar to Key Result", response.data);
    } catch (error) {
      showError("Link Calendar to Key Result", error);
    }
  };

  return (
    <Container maxWidth="md">
      <Box py={5}>
        <Typography variant="h5">Dev Playground</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Log in as a manager-role account first (or the seeded OKR demo admin), then click through in order.
        </Typography>
        <Typography variant="caption" component="div" sx={{ mb: 2, fontFamily: "monospace" }}>
          objective: {objectiveId || "none yet"} | key result: {keyResultId || "none yet"} | calendar entry: {calendarEntryId || "none yet"}
        </Typography>

        <Stack spacing={1} sx={{ maxWidth: 360 }}>
          <Button variant="contained" onClick={createObjective}>1. Create Objective</Button>
          <Button variant="contained" onClick={editObjective}>2. Edit Objective</Button>
          <Button variant="contained" onClick={createKeyResult}>3. Create Key Result</Button>
          <Button variant="contained" onClick={createCalendarEntry}>4. Create Calendar Entry</Button>
          <Button variant="contained" onClick={linkCalendarToKeyResult}>5. Link Calendar to Key Result</Button>
          <Button variant="outlined" color="error" onClick={deleteObjective}>6. Delete Objective (cleans up 1-3)</Button>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle2">Result</Typography>
        <Box
          component="pre"
          sx={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#111",
            color: "#0f0",
            p: 2,
            borderRadius: 1,
            fontSize: 13,
            minHeight: 120,
          }}
        >
          {log}
        </Box>
      </Box>
    </Container>
  );
}
