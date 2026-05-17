import { useEffect, useState, useMemo, useCallback } from "react";
import ExcelJS from "exceljs";
import { useDispatch, useSelector } from "react-redux";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "moment/locale/en-au";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Modal,
} from "@mui/material";
import Typography from "@mui/material/Typography";
import ButtonAddEntry from "../components/ButtonAddEntry";
import FilterButton from "../components/FilterButton";
import {
  getUserEntries,
  getSupervisorEntries,
} from "../features/calendar/calendarSlice";
import { getUser } from "../../features/auth/authSlice";
import { BackButton } from "../../components/Buttons/BackButton";
import {
  getCategoryColour,
  replaceObjectId,
  removeDuplicateEntries,
  filterEntriesByStatus,
  removeDomain,
} from "../components/UtilityFunctions";
import { handleAddNewEntry } from "./BusinessCalendarHome";
import AddEditEntry from "../components/AddEditEntry";
import EntryViewer from "../components/EntryViewer";

moment.updateLocale("en", { week: { dow: 1 } });
const localizer = momentLocalizer(moment);

const getAgendaDateRange = (date) => {
  const start = moment(date).startOf("day");
  const end = moment(start).add(30, "days").endOf("day");
  return { start: start.toDate(), end: end.toDate() };
};

function CalendarView() {
  //Filter state
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
    let isMounted = true;

    const fetchData = async () => {
      dispatch(getUser());
      dispatch(getUserEntries());
      dispatch(getSupervisorEntries());
    };
    if (isMounted) fetchData();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // Destructure variables from global state in Redux store
  const { users } = useSelector((state) => state.auth);
  const {
    userEntries,
    supervisorEntries,
    isLoading: isCalendarLoading,
  } = useSelector((state) => state.calendar);

  //Entry viewer control state
  const [isEntry, setIsEntry] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Calendar navigation state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState("month");

  // Effect to handle scrolling when isEntry becomes true or selectedEntry changes value
  useEffect(() => {
    if (isEntry && selectedEntry !== null) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  }, [isEntry, selectedEntry]);

  // Modal control
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setIsEntry(false);
    setOpen(false);
  };

  // Entry data
  const [entryData, setEntryData] = useState({
    title: "",
    startTime: new Date(),
    endTime: new Date(),
    recurrence: { freq: "None", until: null },
    category: "general",
    priority: "Normal",
    whenAlarm: null,
    description: "",
    userAssigned: [],
  });

  // Memoize filterEntries function with useCallback
  const filterEntries = useCallback(
    (entries) => {
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
    },
    [filterOptions]
  );

  // Memoize calendar entries processing
  const { filteredEntries, actualEvents } = useMemo(() => {
    // Early return if data not loaded yet
    if (!users || !userEntries || !supervisorEntries) {
      return { filteredEntries: [], actualEvents: [] };
    }

    // Combine user and supervisor entries and remove duplicates
    const userEntriesNoDup = removeDuplicateEntries(
      userEntries,
      supervisorEntries
    );

    // Get all entries for calendar
    const calendarEntries = [...userEntriesNoDup, ...supervisorEntries];

    let calendarPageEntries;
    if (filterOptions.completionStatus === "cancelled") {
      calendarPageEntries = filterEntriesByStatus(calendarEntries, [
        "cancelled",
      ]);
    } else {
      calendarPageEntries = filterEntriesByStatus(calendarEntries, [
        "not started",
        "in progress",
        "overdue",
        "completed",
      ]);
    }

    // Replace object IDs with emails
    let updatedEntries = replaceObjectId(
      users,
      calendarPageEntries,
      "userAssigned"
    );
    updatedEntries = replaceObjectId(users, updatedEntries, "userOwner");

    // Apply filters
    const filteredEntriesPrime = filterEntries(updatedEntries);

    // Remove domain
    const filtered = removeDomain(filteredEntriesPrime);

    // Convert to calendar format
    const events = filtered.map((entry) => {
      let start = new Date(entry.startTime);
      const end = new Date(entry.endTime);

      // Check if entry.startTime exists
      if (!entry.startTime) {
        // Set startTime to 30 mins before endTime
        start = new Date(end.getTime() - 30 * 60000);
      }

      return {
        _id: entry._id,
        title: entry.title,
        description: entry.description,
        start: start,
        end: end,
        category: entry.category,
        completionStatus: entry.completionStatus,
      };
    });

    return { filteredEntries: filtered, actualEvents: events };
  }, [users, userEntries, supervisorEntries, filterOptions, filterEntries]);

  // Email list for the dropdowns
  const emailList = useMemo(() => {
    return users ? users.map((user) => user.email) : [];
  }, [users]);

  /*---------------------- HANDLERS ----------------------*/
  // Calendar navigation handler
  const onNavigate = useCallback((newDate) => {
    setCurrentDate(newDate);
  }, []);

  // Calendar view change handler
  const onViewChange = useCallback((newView) => {
    setCurrentView(newView);
  }, []);

  // Memoize event handlers
  const handleSelectEvent = useCallback(
    ({ _id }) => {
      const entry = filteredEntries.find((entry) => entry._id === _id);
      if (entry) {
        setSelectedEntry(entry);
        setIsEntry(true);
      } else {
        console.log("Entry not found");
      }
    },
    [filteredEntries]
  );

  const handleSelectSlot = useCallback(
    (e) => {
      setIsEntry(false);
      const { start, end } = e;
      setEntryData({
        ...entryData,
        startTime: new Date(start),
        endTime: new Date(end),
      });
      setOpen(true);
    },
    [entryData]
  );

  const handlePrintAgenda = useCallback(async () => {
    try {
      // Get the date range for the current agenda view
      const { start, end } = getAgendaDateRange(currentDate);

      // Filter events that fall within the agenda date range
      const agendaEvents = actualEvents.filter((event) => {
        const eventStart = new Date(event.start);
        return eventStart >= start && eventStart <= end;
      });

      // Sort events by start time
      agendaEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("My Agenda");

      // Define columns
      worksheet.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "Time", key: "time", width: 15 },
        { header: "Event Title", key: "title", width: 30 },
        { header: "Assigned To", key: "assignedTo", width: 25 },
      ];

      // Style the header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" },
      };

      // Add data rows
      agendaEvents.forEach((event) => {
        const eventStart = moment(event.start);
        const eventEnd = moment(event.end);

        // Find the original entry to get assignedTo
        const originalEntry = filteredEntries.find(
          (entry) => entry._id === event._id
        );
        const assignedTo = originalEntry?.userAssigned?.[0] || "";

        worksheet.addRow({
          date: eventStart.format("DD/MM/YYYY"),
          time: `${eventStart.format("HH:mm")} - ${eventEnd.format("HH:mm")}`,
          title: event.title,
          assignedTo: assignedTo,
        });
      });

      // Generate Excel file and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "My Agenda.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);

      console.log(`Exported ${agendaEvents.length} events to My Agenda.xlsx`);
    } catch (error) {
      console.error("Error generating Excel file:", error);
    }
  }, [currentDate, actualEvents, filteredEntries]);

  // Styles
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

  // Calendar date formats
  const formats = useMemo(
    () => ({
      agendaDateFormat: "DD/MM/YY",
      agendaHeaderFormat: ({ start, end }) =>
        `${moment(start).format("DD/MM/YY")} — ${moment(end).format("DD/MM/YY")}`,
      dayHeaderFormat: "dddd DD/MM/YYYY",
      dayRangeHeaderFormat: ({ start, end }) =>
        `${moment(start).format("DD/MM/YY")} — ${moment(end).format("DD/MM/YY")}`,
    }),
    []
  );

  if (isCalendarLoading === true) {
    return <div> Loading...</div>;
  }

  return (
    <div>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="h5">Calendar View</Typography>
        <BackButton />
      </Box>
      <Box mt={0} mb={2} component="main" sx={{ flexGrow: 1, py: 8 }}>
        <Container maxWidth={false}>
          <Card sx={{ marginTop: "-50px" }}>
            <Divider />
            <CardContent>
              <Box
                gap={4}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Box gap={4} sx={{ display: "flex" }}>
                  <ButtonAddEntry
                    height="50px"
                    color="#0d6efd"
                    emailList={emailList}
                    handleAddNewEntry={handleAddNewEntry}
                  />
                  <FilterButton
                    emailList={emailList}
                    setFilterOptions={setFilterOptions}
                    filterOptions={filterOptions}
                  />
                </Box>
                {currentView === "agenda" && (
                  <Button
                    variant="contained"
                    onClick={handlePrintAgenda}
                    sx={{ height: "50px" }}
                  >
                    Print Agenda
                  </Button>
                )}
              </Box>
              <Divider style={{ margin: 10 }} />
              <Calendar
                localizer={localizer}
                selectable
                events={actualEvents}
                date={currentDate}
                view={currentView}
                onNavigate={onNavigate}
                onView={onViewChange}
                onSelectEvent={handleSelectEvent}
                onSelectSlot={handleSelectSlot}
                startAccessor="start"
                endAccessor="end"
                max={new Date(1972, 0, 1, 21, 0, 0)}
                min={new Date(1972, 0, 1, 6, 0, 0)}
                formats={formats}
                eventPropGetter={(event) => {
                  let style = {
                    backgroundColor: getCategoryColour(event.category),
                    borderColor: getCategoryColour(event.category),
                    color: "white",
                  };

                  if (event.completionStatus === "overdue") {
                    style.color = "yellow";
                  } else if (event.completionStatus === "cancelled") {
                    style.backgroundColor = "#A9A9A9";
                    style.borderColor = "#A9A9A9";
                    style.textDecoration = "line-through";
                  } else if (event.completionStatus === "completed") {
                    style.textDecoration = "line-through";
                  }

                  return { style };
                }}
                style={{ height: 700 }}
              />
            </CardContent>
          </Card>
        </Container>
        <div>
          <Modal open={open} onClose={handleClose}>
            <Box sx={modalStyle}>
              <AddEditEntry
                entryData={entryData}
                handleAddNewEntry={handleAddNewEntry}
                emailList={emailList}
                onCancel={handleClose}
              />
            </Box>
          </Modal>
        </div>
        <Container sx={{ marginTop: "20px" }}>
          {isEntry ? (
            <EntryViewer
              entryData={selectedEntry}
              type={
                selectedEntry.completionStatus === "cancelled" ||
                selectedEntry.completionStatus === "completed"
                  ? "history"
                  : undefined
              }
            />
          ) : null}
        </Container>
      </Box>
    </div>
  );
}

export default CalendarView;
