import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GridLegacy, Box } from "@mui/material";
import ButtonAddEntry from "../components/ButtonAddEntry";
import FilterButton from "../components/FilterButton";
import UserEntryList from "../components/UserEntryList";
import { toast } from "react-toastify";
import { getUser } from "../../features/auth/authSlice";
import {
  getAllEntry,
  createEntry,
} from "../features/calendar/calendarSlice";
import { replaceObjectId, sortEntries } from "../components/UtilityFunctions";

// Handler
export const handleAddNewEntry = async (formData, dispatch) => {
  // Create a copy of the formData object
  const newFormData = { ...formData };

  // Transform priority to lowercase in the newFormData
  newFormData.priority = newFormData.priority.toLowerCase();

  // Create createdAt and updatedAt dates in the newFormData
  const currentDate = new Date();
  newFormData.createdAt = currentDate.toISOString();
  newFormData.updatedAt = currentDate.toISOString();

  // Assign lowercase value of recurrence to new field recurrence.freq
  newFormData.recurrence = {
    freq: newFormData.recurrence.toLowerCase(),
    until: newFormData.until,
  };

  try {
    const createdEntry = await dispatch(createEntry(newFormData));

    // Log the response data to the console
    console.log("New entry created:", createdEntry.payload);
    toast.success("New entry created");

    setTimeout(() => {
      window.location.reload();
    }, 1000);

    // You can handle any further actions after successful creation of the entry here
  } catch (error) {
    // Handle any errors that occur during the request
    toast.error("Failed to create entry.");
    console.error("Error creating calendar entry:", error);
    // You can handle error cases here, such as displaying an error message to the user
  }
};

function BusCalAdmin() {
  // Filter states
  const [filterOptions, setFilterOptions] = useState({
    startDate: null,
    endDate: null,
    categories: [],
    users: [],
    priority: "all",
    completionStatus: "all",
  });

  const dispatch = useDispatch();

  // Fetch initial required data from backend
  useEffect(() => {
    dispatch(getAllEntry());
    dispatch(getUser());
  }, [dispatch]);

  // Destructure variables from global state in Redux store
  const { users, isLoading } = useSelector((state) => state.auth);
  const { allEntries, isLoading: isCalendarLoading } = useSelector(
    (state) => state.calendar
  );
  if (isLoading || isCalendarLoading) {
    return <p>Loading...</p>;
  } else {
    // Control for the filter button
    const filterEntries = (entries, filterOptions) => {
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

    // Email list for the dropdowns
    const emailList = users.map((user) => user.email);

    // Replace object IDs with emails
    let updatedEntries = replaceObjectId(users, allEntries, "userAssigned");
    updatedEntries = replaceObjectId(users, updatedEntries, "userOwner");

    // Apply filter and sort chronologically
    const filteredEntries = filterEntries(updatedEntries, filterOptions);
    const sortedEntries = sortEntries(filteredEntries);

    return (
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
          gap: "16px",
        }}
      >
        {/* Top Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto 1fr",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <ButtonAddEntry
            height="50px"
            color="#0d6efd"
            emailList={emailList}
            handleAddNewEntry={handleAddNewEntry}
          />
          <Box gridColumn="3 / 4">
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
          </Box>
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
            <GridLegacy item xs={12}>
              <UserEntryList userName={"Everyone"} entries={sortedEntries} />
            </GridLegacy>
          </GridLegacy>
        </div>
      </div>
    );
  }
}

export default BusCalAdmin;
