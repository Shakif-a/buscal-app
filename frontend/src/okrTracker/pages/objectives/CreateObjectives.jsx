import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { createObjective as createObjectiveThunk } from "../../features/objectives/objectiveSlice";
import objectiveService from "../../features/objectives/objectiveService";
import userService from "../../features/users/userService"
import "./CreateObjectives.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function CreateObjectives() {
  // The dark navy colour used for headings and text.
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const navy = "#1a2b4a";
 
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [group, setGroup] = useState("");
  const [commitmentType, setCommitmentType] = useState("");
 
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [groupOptions, setGroupOptions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
 
  useEffect(() => {
    async function loadOptions() {
      try {
        const [groupsData, usersData] = await Promise.all([
          objectiveService.getObjectiveGroups(user.token),
          userService.getUsers(user.token),
        ]);
 
        setGroupOptions(
          Array.isArray(groupsData)
            ? groupsData
            : groupsData.groups || []
        );
 
        setOwnerOptions(
          usersData.map((u) => ({
            id: u._id,
            label:
              [u.firstName, u.lastName].filter(Boolean).join(" ") ||
              u.email ||
              "Unknown user",
          }))
        );
      } catch (error) {
        console.error("Could not load owners:", error);
      }
    }
 
    if (user?.token) {
      loadOptions();
    }
  }, [user?.token]);
 
  const today = new Date();
 
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
// user can choose date
  const [selectedDate, setSelectedDate] = useState(null);
 
  const commitmentTypeOptions = [
    { value: "committed", label: "Committed" },
    { value: "aspirational", label: "Aspirational" },
  ];
 
  // calendar heading.
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
 
  function firstWeekdayMondayFirst(year, month) {
    const jsDay = new Date(year, month, 1).getDay();
    return (jsDay + 6) % 7;
  }
 
  function previousMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }
 
  // Move the calendar forward
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }
 
  // Pick a day
  function selectDay(day) {
    setSelectedDate({ year: viewYear, month: viewMonth, day: day });
  }
 
  function isSelected(day) {
    return (
      selectedDate &&
      selectedDate.year === viewYear &&
      selectedDate.month === viewMonth &&
      selectedDate.day === day
    );
  }
 
  // Build the list of cells for the calendar
  function buildCalendarCells() {
    const total = daysInMonth(viewYear, viewMonth);
    const leadingBlanks = firstWeekdayMondayFirst(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < leadingBlanks; i++) {
      cells.push("");
    }
    for (let day = 1; day <= total; day++) {
      cells.push(day);
    }
    return cells;
  }
 
  // Clear the form back to empty.
  function cancel() {
    setTitle("");
    setDescription("");
    setOwner("");
    setGroup("");
    setCommitmentType("");
    setSelectedDate(null);
  }
 
  async function createObjective() {
    if (!user?.token) {
      alert("Your session has expired. Please log in again.");
      return;
    }
 
    if (!title.trim()) {
      alert("Please enter an objective title.");
      return;
    }
 
    if (!selectedDate) {
      alert("Please select a due date.");
      return;
    }
 
    if (!owner) {
      alert("Please select an owner.");
      return;
    }
 
    if (!commitmentType) {
      alert("Please select a type.");
      return;
    }
 
    const month = String(selectedDate.month + 1).padStart(2, "0");
    const day = String(selectedDate.day).padStart(2, "0");
    const dueDate = `${selectedDate.year}-${month}-${day}`;
 
    try {
      setIsSubmitting(true);
      await dispatch(
        createObjectiveThunk({
          title: title.trim(),
          description,
          dueDate,
          group,
          commitmentType,
          owner,
        })
      ).unwrap();
 
      setShowSuccessPopup(true);
      cancel();
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }
 
  // A shared style for the three dropdowns.
  const selectStyle = {
    width: "220px",
    padding: "14px 16px",
    borderRadius: "10px",
    border: "1px solid #ddd",
    color: navy,
    fontSize: "16px",
    backgroundColor: "#fff",
    cursor: "pointer",
    outline: "none",
  };
 
  // A shared style for the field labels.
  const labelStyle = {
    color: navy,
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "10px",
    display: "block",
  };
 
  return (
    <div className="create-objectives">
 
      {/* Page header */}
      <div style={{ padding: "30px 40px" }}>
        <div className="create-header">
          <div className="create-header-title">
            <img
              src="/images/okr/ArrowLogoLeft.png"
              alt = "Arrow Logo L"
              className = "logo"/>
            <h1>Create Objectives</h1>
          </div>
          <img
              src="/images/okr/ArrowLogoRight.png"
              alt = "Arrow Logo R"
              className = "logo"/>
        </div>
      </div>
 
      {/* Main form*/}
      <div>
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "16px",
            padding: "40px",
          }}
        >
          {/* Two column layout: form on the left, description on the right */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
            {/* Left column */}
            <div>
              {/* Title */}
              <label style={labelStyle}>Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter Objective title"
                style={{
                  width: "100%",
                  padding: "16px 18px",
                  borderRadius: "10px",
                  border: "1px solid #ddd",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: "30px",
                }}
              />
 
              {/* Due Date with the calendar */}
              <label style={labelStyle}>Due Date</label>
              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: "12px",
                  padding: "20px",
                  marginBottom: "30px",
                  background: "#ffffff",
                }}
              >
                {/* Calendar header with arrows and the month name */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                  }}
                >
                  <button
                    onClick={previousMonth}
                    className="calendar-arrow">
                    ‹
                  </button>
                  <div style={{ color: navy, fontSize: "20px", fontWeight: "bold" }}>
                    {monthNames[viewMonth]} {viewYear}
                  </div>
                  <button
                    onClick={nextMonth}
                    className="calendar-arrow">
                    ›
                  </button>
                </div>
 
                {/* Weekday headings */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    textAlign: "center",
                    color: "#999",
                    fontSize: "14px",
                    marginBottom: "10px",
                  }}
                >
                  <div>Mo</div>
                  <div>Tu</div>
                  <div>We</div>
                  <div>Th</div>
                  <div>Fr</div>
                  <div>Sa</div>
                  <div>Su</div>
                </div>
 
                {/* The day cells */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    textAlign: "center",
                    rowGap: "8px",
                  }}
                >
                  {buildCalendarCells().map((cell, index) => {
                    // Blank leading cell.
                    if (cell === "") {
                      return <div key={index}></div>;
                    }
                    const selected = isSelected(cell);
                    return (
                      <div
                        key={index}
                        onClick={() => selectDay(cell)}
                        style={{
                          padding: "10px 0",
                          margin: "0 4px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          color: selected ? navy : "#333",
                          fontWeight: selected ? "bold" : "normal",
                          backgroundColor: selected ? "#7fbce0" : "transparent",
                        }}
                      >
                        {cell}
                      </div>
                    );
                  })}
                </div>
              </div>
 
              {/* Owner dropdown */}
              <label style={labelStyle}>Owner</label>
              <div style={{ marginBottom: "24px" }}>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Select owner</option>
                  {ownerOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
 
              {/* Group dropdown */}
              <label style={labelStyle}>Group</label>
              <div style={{ marginBottom: "24px" }}>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Select group</option>
                  {groupOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
 
              {/* Type dropdown */}
              <label style={labelStyle}>Type</label>
              <div>
                <select
                  value={commitmentType}
                  onChange={(e) => setCommitmentType(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Select type</option>
                  {commitmentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
 
            {/* Right column: description */}
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the Objective. This is displayed on the calendar."
                style={{
                  width: "100%",
                  height: "340px",
                  padding: "18px",
                  borderRadius: "12px",
                  border: "1px solid #ddd",
                  fontSize: "16px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "sans-serif",
                }}
              />
            </div>
          </div>
 
          {/* Cancel and Create buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "16px",
              marginTop: "40px",
            }}
          >
            <button
              onClick={cancel}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              onClick={createObjective}
              disabled={isSubmitting}
              className="create-objective-button"
              >
              {isSubmitting ? "Creating..." : "Create New Objective"}
            </button>
          </div>
        </div>
      </div>
      {showSuccessPopup && (
        <div className="popup-overlay">
          <div className="success-popup">
            <h2>Objective Created</h2>
            <p>Your Objective has been created successfully</p>
            <button className="popup-close-button"
            onClick={() => setShowSuccessPopup(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
 
export default CreateObjectives;