import * as React from "react";
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Box, Container } from "@mui/material";
import GridLegacy from "@mui/material/GridLegacy";

import {
  deleteUser,
  getUser,
  manageUserOne,
} from "../../../features/auth/authSlice";

import Spinner from "../../../components/Spinner";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import BreadcrumbsActiveLast from "../../../components/Navigation/Breadcrumbs/BreadcrumbsActiveLast";
import DropdownSelect from "../../../components/Forms/Dropdowns/DropdownSelect";
import DropDownMultiChip from "../../../components/Forms/Dropdowns/DropDownMultiChip";
import Button from "@mui/material/Button";
import SendIcon from "@mui/icons-material/Send";
import DeleteIcon from "@mui/icons-material/Delete";
import DialogAlert from "../../../components/Feedback/Dialog/DialogAlert";
import { toast } from "react-toastify";
import UserInfo from "./UserInfo";
import DatePickerComponent from "../../../components/DataDisplay/DatePickerComponent";

const filterOptions = createFilterOptions({
  matchFrom: "start",
  stringify: (option) => option.email,
});

export default function ManageAccounts({ props }) {
  const dispatch = useDispatch();

  const { user, users, isLoading, isError, message } = useSelector(
    (state) => state.auth
  );

  const arr1 = [{ email: "", _id: "" }];
  const execTeam = users.concat(arr1);
  const supervisorOptions = [{ email: "None", _id: "none" }, ...users];

  const [owner, setOwner] = React.useState(null);
  const [role, setRole] = React.useState([]);
  const [removeRole, setRemoveRole] = React.useState([]);

  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [phoneNumberError, setPhoneNumberError] = React.useState(false);

  const [exec, setExec] = React.useState("");
  const [supervisor, setSupervisor] = React.useState("");
  const [supervisorChanged, setSupervisorChanged] = React.useState(false);

  const [startDate, setStartDate] = React.useState(null);
  const [terminationDate, setTerminationDate] = React.useState(null);

  // ------------------ FUNCTIONS ------------------

  function setTheOwner(res) {
    setSupervisor("");
    setSupervisorChanged(false);
    setOwner(null);

    if (res) {
      setOwner(res);
      setExec(res.exec ? res.exec : "no");
      setSupervisor(res.supervisor ? res.supervisor : "");
      setStartDate(res.startDate ? new Date(res.startDate) : null);
      setTerminationDate(
        res.terminationDate ? new Date(res.terminationDate) : null
      );
    } else {
      setOwner(null);
      setRole([]);
      setExec("no");
      setSupervisor("");
      setSupervisorChanged(false);
      setStartDate(null);
      setTerminationDate(null);
    }
  }

  function updateUserData() {
    let roles = [];

    if (owner.roles.includes("pending")) {
      roles = [...new Set(role.map((r) => r.toLowerCase()))];
      roles = roles.filter(
        (r) => !removeRole.includes(r.toLowerCase())
      );
    } else {
      roles = [...new Set(role.map((r) => r.toLowerCase()))];
      roles = roles.filter(
        (r) => !removeRole.includes(r.toLowerCase())
      );

      roles = [
        ...new Set(
          roles.concat(owner.roles.map((r) => r.toLowerCase()))
        ),
      ];
    }

    if (!/^\d*$/.test(phoneNumber)) {
      setPhoneNumberError(true);
      alert("Please enter only numbers for the phone number.");
      return;
    }

    const data = {
      _id: owner._id,
      roles,
      exec,
      removedRole: removeRole.map((r) => r.toLowerCase()),
      phoneNumber,
    };

    if (supervisorChanged) {
      data.supervisor = supervisor === "none" ? null : supervisor;
    }

    if (startDate !== undefined) data.startDate = startDate;
    if (terminationDate !== undefined) data.terminationDate = terminationDate;

    try {
      if (user.roles.includes("admin")) {
        dispatch(manageUserOne(data));
        dispatch(getUser());

        toast.success(
          "Success! Ask the user to log out and back in to see changes."
        );

        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (error) {
      toast.error("You do not have admin access!");
    }

    setRole([]);
    setRemoveRole([]);
    setExec("");
    setSupervisor("");
    setSupervisorChanged(false);
    setPhoneNumber("");
    setPhoneNumberError(false);
    setStartDate(null);
    setTerminationDate(null);
  }

  function deleteUserById() {
    try {
      dispatch(deleteUser(owner._id));
      toast.success("Deleted!");
    } catch {
      toast.error("Error occurred!");
    }
  }

  const handlePhoneNumberChange = (event) => {
    setPhoneNumber(event.target.value);
    setPhoneNumberError(false);
  };

  const handleSupervisorChange = (event, value) => {
    if (value && value._id === "none") {
      setSupervisor("none");
    } else if (value) {
      setSupervisor(value._id);
    } else {
      setSupervisor("");
    }
    setSupervisorChanged(true);
  };

  const isValidPhoneNumber = (number) =>
    /^\d*$/.test(number);

  // ------------------ USE EFFECT ------------------

  useEffect(() => {
    if (isError) console.log(message);

    dispatch(getUser());
  }, [isError, message, dispatch]);

  // ------------------ LOADING ------------------

  if (isLoading) return <Spinner />;

  // ------------------ RENDER ------------------

  return (
    <Box display="flex" width="100%" m={1}>
      <Container maxWidth="lg">
        <BreadcrumbsActiveLast
          links={[
            { heading: "Account", link: "/dashboard/settings" },
            { heading: "Manage", link: "/" },
          ]}
        />

        <Box sx={{ display: "flex", flexDirection: "row" }}>
          {/* LEFT PANEL */}
          <Box sx={{ flex: "0 0 330px", padding: 4 }}>
            <GridLegacy container spacing={2}>
              <GridLegacy item xs={12}>
                <Autocomplete
                  options={users}
                  getOptionLabel={(o) => o.email}
                  onChange={(e, v) => setTheOwner(v || null)}
                  filterOptions={filterOptions}
                  renderInput={(params) => (
                    <TextField {...params} label="User" />
                  )}
                />
              </GridLegacy>

              {owner && (
                <>
                  <GridLegacy item xs={12}>
                    <DropDownMultiChip
                      dropDownLabel="Assign Role"
                      getter={role}
                      setter={setRole}
                      list={["Employee", "QM", "Sales-Team", "Admin"]}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <DropDownMultiChip
                      dropDownLabel="Remove Role"
                      getter={removeRole}
                      setter={setRemoveRole}
                      list={["Employee", "QM", "Sales-Team", "Admin"]}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <DropdownSelect
                      title="Exec team"
                      getter={exec}
                      setter={setExec}
                      mitems={["yes", "no"]}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <Autocomplete
                      options={supervisorOptions}
                      getOptionLabel={(o) => o.email}
                      onChange={handleSupervisorChange}
                      renderInput={(params) => (
                        <TextField {...params} label="Supervisor" />
                      )}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <TextField
                      label="Phone Number"
                      value={phoneNumber}
                      onChange={handlePhoneNumberChange}
                      error={phoneNumberError}
                      helperText={
                        phoneNumberError ? "Invalid phone number" : ""
                      }
                    />
                  </GridLegacy>

                  {/* Start Date */}
                  <GridLegacy item xs={12}>
                    <DatePickerComponent
                      setDate={setStartDate}
                      label="Start Date"
                      value={startDate}
                    />
                  </GridLegacy>

                  {/* Termination Date */}
                  <GridLegacy item xs={12}>
                    <DatePickerComponent
                      setDate={setTerminationDate}
                      label="Termination Date"
                      value={terminationDate}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <Button
                      variant="contained"
                      endIcon={<SendIcon />}
                      onClick={updateUserData}
                    >
                      Update
                    </Button>

                    <DialogAlert
                      setter={deleteUserById}
                      buttonColor="error"
                      buttonTitle="Delete"
                      buttonIcon={<DeleteIcon />}
                      dialogTitle="Delete User"
                      dialogDescription="Are you sure? This cannot be undone."
                      dialogCancelTitle="Cancel"
                      dialogAcceptTitle="Delete user"
                    />
                  </GridLegacy>
                </>
              )}
            </GridLegacy>
          </Box>

          {/* RIGHT PANEL */}
          <Box sx={{ flex: 1, padding: 3 }}>
            <UserInfo employee={owner} />
          </Box>
        </Box>
      </Container>
    </Box>
  );
}