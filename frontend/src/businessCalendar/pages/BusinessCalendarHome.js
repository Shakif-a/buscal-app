import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import GridLegacy from "@mui/material/GridLegacy";
import ButtonAddEntry from "../components/ButtonAddEntry";
import FilterButton from "../components/FilterButton";
import UserEntryList from "../components/UserEntryList";
import LinkCard from "../components/LinkCard";
import SearchField from "../components/history/SearchField";
import { toast } from "react-toastify";
import { getUser } from "../../features/auth/authSlice";
import {
  replaceObjectId,
  sortEntries,
  filterEntriesByStatus,
  removeDuplicateEntries,
} from "../components/UtilityFunctions";
import {
  getUserEntries,
  getSupervisorEntries,
  createEntry,
} from "../features/calendar/calendarSlice";

// Handler
export const handleAddNewEntry = async (formData, dispatch) => {
  const newFormData = { ...formData };
  newFormData.priority = newFormData.priority.toLowerCase();

  const currentDate = new Date();
  newFormData.createdAt = currentDate.toISOString();
  newFormData.updatedAt = currentDate.toISOString();

  newFormData.recurrence = {
    freq: newFormData.recurrence.toLowerCase(),
    until: newFormData.until,
  };

  try {
    const createdEntry = await dispatch(createEntry(newFormData));
    console.log("New entry created:", createdEntry.payload);
    toast.success("New entry created");

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  } catch (error) {
    toast.error("Failed to create entry.");
    console.error("Error creating calendar entry:", error);
  }
};

function BusinessCalendarHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [filterOptions, setFilterOptions] = useState({
    startDate: null,
    endDate: null,
    categories: [],
    users: [],
    priority: "all",
    completionStatus: "all",
  });

  const [filterOptions2, setFilterOptions2] = useState({
    startDate: null,
    endDate: null,
    categories: [],
    users: [],
    priority: "all",
    completionStatus: "all",
  });

  const [searchText, setSearchText] = useState("");

  const dispatch = useDispatch();

  // Update URL when search text changes
  const handleSearchChange = (newSearchText) => {
    setSearchText(newSearchText);
    const searchParams = new URLSearchParams(location.search);
    if (newSearchText) {
      searchParams.set("search", newSearchText);
    } else {
      searchParams.delete("search");
    }
    navigate({ search: searchParams.toString() });
  };

  // Initial data fetch
  useEffect(() => {
    dispatch(getUser());
    dispatch(getUserEntries());
    dispatch(getSupervisorEntries());
  }, [dispatch]);

  // Sync URL search parameter with state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get("search") || "";
    setSearchText(query);
  }, [location.search]);

  const { user, users, isLoading } = useSelector((state) => state.auth);
  const {
    userEntries,
    supervisorEntries,
    isLoading: isCalendarLoading,
  } = useSelector((state) => state.calendar);

  if (isLoading || isCalendarLoading) {
    return <p>Loading...</p>;
  }

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

  const emailList = users.map((user) => user.email);

  const homepageEntries = filterEntriesByStatus(userEntries, [
    "not started",
    "in progress",
    "overdue",
  ]);
  const homepageSupEntries = filterEntriesByStatus(supervisorEntries, [
    "not started",
    "in progress",
    "overdue",
  ]);

  const homepageEntriesNoDup = removeDuplicateEntries(
    homepageEntries,
    homepageSupEntries
  );

  let updatedEntries = replaceObjectId(
    users,
    homepageEntriesNoDup,
    "userAssigned"
  );
  updatedEntries = replaceObjectId(users, updatedEntries, "userOwner");
  let updatedSupEntries = replaceObjectId(
    users,
    homepageSupEntries,
    "userAssigned"
  );
  updatedSupEntries = replaceObjectId(users, updatedSupEntries, "userOwner");

  const filteredEntries = filterEntries(updatedEntries, filterOptions);
  const sortedEntries = sortEntries(filteredEntries);
  const filteredSupEntries = filterEntries(updatedSupEntries, filterOptions2);
  const sortedSupEntries = sortEntries(filteredSupEntries);

  const searchedUserEntries = sortedEntries.filter((entry) =>
    entry.title.toLowerCase().includes(searchText.toLowerCase())
  );
  const searchedSupEntries = sortedSupEntries.filter((entry) =>
    entry.title.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "16px",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <ButtonAddEntry
            height="50px"
            color="#0d6efd"
            emailList={emailList}
            handleAddNewEntry={handleAddNewEntry}
          />
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <Box>
              <FilterButton
                setFilterOptions={setFilterOptions}
                emailList={emailList}
                filterOptions={filterOptions}
              />
              {homepageSupEntries && homepageSupEntries.length > 0 && (
                <Typography variant="subtitle2">User's Own</Typography>
              )}
            </Box>
            {homepageSupEntries && homepageSupEntries.length > 0 && (
              <Box>
                <FilterButton
                  setFilterOptions={setFilterOptions2}
                  emailList={emailList}
                  filterOptions={filterOptions2}
                />
                <Typography variant="subtitle2">Supervisees</Typography>
              </Box>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px", marginLeft: "auto" }}>
          <LinkCard link={card.link} image={card.image} title={card.title} />
          <LinkCard link={card1.link} image={card1.image} title={card1.title} />
        </div>
      </div>
      <div>
        <SearchField
          setSearchText={handleSearchChange}
          placeholder="Search Through Entries"
          initialValue={searchText}
        />
      </div>

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
          <GridLegacy
            item
            xs={12}
            sm={12}
            md={homepageSupEntries && homepageSupEntries.length > 0 ? 6 : 12}
          >
            <UserEntryList
              userName={user.firstName}
              entries={searchedUserEntries}
            />
          </GridLegacy>
          {homepageSupEntries && homepageSupEntries.length > 0 && (
            <GridLegacy item xs={12} sm={12} md={6}>
              <UserEntryList
                userName={"Supervisee"}
                entries={searchedSupEntries}
                type={"super"}
              />
            </GridLegacy>
          )}
        </GridLegacy>
      </div>
    </div>
  );
}

export default BusinessCalendarHome;

const card = {
  link: "/dashboard/business-calendar/calendarview",
  image: "/icons/calendar.svg",
  title: "Calendar View",
};
const card1 = {
  link: "/dashboard/business-calendar/history",
  image: "/icons/clock.svg",
  title: "History View",
};
