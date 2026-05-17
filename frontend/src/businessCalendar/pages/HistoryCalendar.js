import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import SearchField from "../components/history/SearchField";
import FilterButton from "../components/FilterButton";
import DetailViewCard from "../components/history/DetailViewCard";
import TableDetails from "../components/history/TableDetails";
import { Box } from "@mui/material";
import GridLegacy from "@mui/material/GridLegacy";
import Typography from "@mui/material/Typography";
import {
  filterEntriesByStatus,
  sortEntries,
  replaceObjectId,
  textFilter,
  findEntryById,
  removeDomain,
  removeDuplicateEntries,
} from "../components/UtilityFunctions";
import { getUser } from "../../features/auth/authSlice";
import {
  getUserEntries,
  getSupervisorEntries,
  getAllHistory,
} from "../features/calendar/calendarSlice";
import { BackButton } from "../../components/Buttons/BackButton";

function HistoryCalendar() {
  //Search state
  const [searchText, setSearchText] = useState("");
  //Filter state
  const [filterOptions, setFilterOptions] = useState({
    startDate: null,
    endDate: null,
    categories: [],
    users: [],
    priority: "all",
    completionStatus: "all",
  });
  // Detail view state
  const [isDetail, setIsDetail] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isUrlSearch, setIsUrlSearch] = useState(false);
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(getUser());
    dispatch(getUserEntries());
    dispatch(getSupervisorEntries());
    dispatch(getAllHistory());
  }, [dispatch]);

  // Sync URL search parameter with state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("search") || "";
    if (query) {
      setIsUrlSearch(true);
    }
    setSearchText(query);
  }, [location.search]);

  const { users } = useSelector((state) => state.auth);
  const {
    userEntries,
    supervisorEntries,
    calendarHistory,
    isLoading: isCalendarLoading,
  } = useSelector((state) => state.calendar);

  // Combine user and supervisor entries and remove duplicates
  const userEntriesNoDup = removeDuplicateEntries(
    userEntries,
    supervisorEntries
  );
  const combinedEntries = [...userEntriesNoDup, ...supervisorEntries];
  // Control for the filter button
  const filterEntries = (entries) => {
    return entries.filter((entry) => {
      const {
        startDate,
        endDate,
        categories,
        users,
        priority,
        completionStatus,
      } = filterOptions;

      const entryEndTime = new Date(entry.endTime);

      const isWithinDateRange =
        (!startDate || entryEndTime >= new Date(startDate)) &&
        (!endDate || entryEndTime <= new Date(endDate));

      const hasSelectedCategory =
        !categories.length || categories.includes(entry.category);
      const hasSelectedUser =
        !users.length || users.includes(entry.userAssigned[0]);

      const hasSelectedPriority =
        priority === "all" || entry.priority === priority;
      const hasSelectedCompletionStatus =
        completionStatus === "all" ||
        entry.completionStatus === completionStatus;

      return (
        hasSelectedCategory &&
        hasSelectedUser &&
        hasSelectedPriority &&
        hasSelectedCompletionStatus &&
        isWithinDateRange
      );
    });
  };
  const rowsPP = 10; //Rows per page
  const disablePrint = true;
  // Email list for the dropdowns
  const emailList = users.map((user) => user.email);

  // Only get completed and cancelled entries for history
  const historyEntries = filterEntriesByStatus(combinedEntries, [
    "completed",
    "cancelled",
  ]);

  // Replace object IDs with emails
  let updatedEntries = replaceObjectId(users, historyEntries, "userAssigned");
  updatedEntries = replaceObjectId(users, updatedEntries, "userOwner");

  const filteredEntries = filterEntries(updatedEntries);
  const searchedEntries = textFilter(filteredEntries, searchText);
  const sortedEntries = removeDomain(sortEntries(searchedEntries));

  // Find the selected entry by id
  const selectedEntry = selectedId
    ? findEntryById(selectedId, searchedEntries)
    : null;

  const rows = convertEntriesToRows(sortedEntries, calendarHistory, users);

  const headerCells = [
    { id: "completionDate", label: "Completion Date" },
    { id: "title", label: "Title" },
    { id: "assignedTo", label: "Assigned To" },
    { id: "completedBy", label: "Completed By" },
    { id: "endTime", label: "Due Date" },
    { id: "daysDifference", label: "Days Difference" },
  ];

  // Auto-select first row when search comes from URL
  useEffect(() => {
    if (isUrlSearch && searchedEntries && searchedEntries.length > 0) {
      const firstRowId = searchedEntries[0]._id;
      setSelectedId(firstRowId);
      setIsDetail(true);
      setIsUrlSearch(false); // Reset flag so it only happens once
    }
  }, [isUrlSearch, searchedEntries]);

  /*---------------------- HANDLERS ----------------------*/
  const handleRowClick = (id) => {
    if (selectedId === id) {
      setIsDetail((prevState) => !prevState); // Toggle the detail view
    } else {
      setSelectedId(id); // Set the selected ID
      setIsDetail(true); // Show the detail view
    }
  };

  // Update URL when search text changes
  const handleSearchChange = (newSearchText) => {
    setIsUrlSearch(false);
    setSearchText(newSearchText);
    const searchParams = new URLSearchParams(location.search);
    if (newSearchText) {
      searchParams.set("search", newSearchText);
    } else {
      searchParams.delete("search");
    }
    navigate({ search: searchParams.toString() });
  };

  if (isCalendarLoading === true) {
    return <div> Loading...</div>;
  }

  return (
    <div>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="h5">History View</Typography>
        <BackButton />
      </Box>
      {/* Top Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto 1fr", // Added an additional column
          alignItems: "center",
          gap: "16px",
        }}
      >
        <SearchField
          setSearchText={handleSearchChange}
          initialValue={searchText}
        />
        <FilterButton
          setFilterOptions={setFilterOptions}
          emailList={emailList}
          filterOptions={filterOptions}
          style={{
            alignSelf: "start",
            justifySelf: "start",
            width: "auto", // Takes up as little space as possible
          }}
        />
      </div>
      {/* Middle Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "16px",
        }}
      >
        <GridLegacy
          container
          spacing={2}
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <GridLegacy item xs={12} sm={12} md={12} lg={isDetail ? 7 : 10}>
            <Typography variant="h6">Completed Entries</Typography>
            {rows && rows.length > 0 ? (
              <>
                <TableDetails
                  rows={rows}
                  headerCells={headerCells}
                  rowsPP={rowsPP}
                  disablePrint={disablePrint}
                  onRowClick={handleRowClick}
                  isFontWhite={true}
                />
              </>
            ) : (
              <Typography variant="body1">No entries</Typography>
            )}
          </GridLegacy>
          {isDetail && (
            <GridLegacy item xs={12} sm={12} md={12} lg={5}>
              <Typography variant="h6">Detail View</Typography>
              <DetailViewCard
                entry={selectedEntry}
                histories={calendarHistory}
                users={users}
              />
            </GridLegacy>
          )}
        </GridLegacy>
      </div>
    </div>
  );
}

export default HistoryCalendar;
// Updated convertEntriesToRows function
const convertEntriesToRows = (entries, calendarHistory, users) => {
  // Helper function to calculate days difference
  const calculateDaysDifference = (completionDate, dueDate) => {
    const completion = new Date(completionDate);
    const due = new Date(dueDate);
    const diffTime = due - completion;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}, ${date.toLocaleTimeString(
      [],
      {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }
    )}`;
  };

  // Helper function to get full name from user data
  const getFullName = (userId) => {
    const user = users.find((u) => u._id === userId);
    if (user && user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return userId; // Fallback to ID if user not found
  };

  // Helper function to convert email or partial email to full name
  const emailToFullName = (emailOrId) => {
    // Try to find by exact ID match first
    let user = users.find((u) => u._id === emailOrId);

    // If not found, try to find by email match (full or partial)
    if (!user) {
      user = users.find(
        (u) => u.email === emailOrId || u.email.startsWith(emailOrId)
      );
    }

    if (user && user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return emailOrId; // Fallback to original value
  };

  // Helper function to get assigned users as full names
  const getAssignedToNames = (userAssignedArray) => {
    if (!userAssignedArray || userAssignedArray.length === 0) {
      return "Unassigned";
    }

    // Map each user to their full name
    const names = userAssignedArray.map((userEmailOrId) =>
      emailToFullName(userEmailOrId)
    );

    // Join multiple names with commas
    return names.join(", ");
  };

  // Helper function to get completion info from history
  const getCompletionInfo = (entryId) => {
    // Find the history document for this entry
    const history = calendarHistory.find((h) => h.ref === entryId);

    if (
      !history ||
      !history.completionChanges ||
      history.completionChanges.length === 0
    ) {
      return { completedBy: null, completionDate: null };
    }

    // Find the completion change where status changed to "completed"
    const completionChange = history.completionChanges.find(
      (change) =>
        change.notes.toLowerCase().includes("completed") &&
        !change.notes.toLowerCase().includes("overdue")
    );

    if (!completionChange) {
      return { completedBy: null, completionDate: null };
    }

    // Get the full name of the user who completed it
    const completedByName = getFullName(completionChange.user);

    return {
      completedBy: completedByName,
      completionDate: completionChange.timestamp,
    };
  };

  // Process entries
  const processEntry = (entry) => {
    const completionInfo = getCompletionInfo(entry._id);

    // Use completion date from history if available, otherwise fall back to updatedAt
    const completionDate = completionInfo.completionDate || entry.updatedAt;

    // Get assigned to names (can be multiple users)
    const assignedTo = getAssignedToNames(entry.userAssigned);

    // Use completed by from history if available, otherwise fall back to first assigned user
    let completedBy;
    if (completionInfo.completedBy) {
      completedBy = completionInfo.completedBy;
    } else if (entry.userAssigned && entry.userAssigned[0]) {
      completedBy = emailToFullName(entry.userAssigned[0]);
    } else {
      completedBy = "Unknown";
    }

    return {
      id: entry._id,
      completionDate: formatDate(completionDate),
      endTime: formatDate(entry.endTime),
      title: entry.title,
      completionStatus: entry.completionStatus,
      assignedTo: assignedTo,
      completedBy: completedBy,
      category: entry.category,
      daysDifference: calculateDaysDifference(completionDate, entry.endTime),
    };
  };

  if (Array.isArray(entries)) {
    return entries.map(processEntry);
  } else if (typeof entries === "object" && entries !== null) {
    return [processEntry(entries)];
  } else {
    return [];
  }
};
