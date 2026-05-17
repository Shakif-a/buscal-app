import React, { useEffect } from "react";
import { useFormik } from "formik";
import {
  Button,
  TextField,
  Paper,
  Container,
  Box,
  GridLegacy,
} from "@mui/material";
import {
  updateUserOne,
  changePassword,
  resetPasswordState,
} from "../../../features/auth/authSlice";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "../../../components/Spinner";
import TabsBasic from "../../../components/Navigation/Tabs/TabsBasic";
import { toast } from "react-toastify";
import useDidMountEffect from "../../../components/Hooks/useDidMountEffect";

const QMAccountDetails = () => {
  const dispatch = useDispatch();

  const {
    user,
    isError,
    message,
    isLoading,
    isSuccess,
    changePasswordMessage,
    changePasswordError,
    changePasswordSuccess,
  } = useSelector((state) => state.auth);

  const tabCount = 3;

  const formik = useFormik({
    initialValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: (values) => {
      try {
        var _id = user._id;
        var firstName = user.firstName;
        var lastName = user.lastName;
        var email = user.email;
        var password = "";
        var roles = user.roles;
      } catch (error) {}

      if (values.firstName) {
        firstName = values.firstName;
      }
      if (values.lastName) {
        lastName = values.lastName;
      }
      if (values.email) {
        email = values.email;
      }
      if (values.password) {
        password = values.password;
      }

      const data = { _id, firstName, lastName, email, password, roles };

      if (password !== values.confirmPassword) {
        toast.error("Password mismatch! Please re-enter.");
      } else {
        dispatch(updateUserOne(data));
        formik.values.password = "";
        formik.values.confirmPassword = "";
      }
    },
  });

  // Separate formik for password change
  const passwordFormik = useFormik({
    initialValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: (values) => {
      // Basic frontend validation
      if (
        !values.currentPassword ||
        !values.newPassword ||
        !values.confirmPassword
      ) {
        toast.error("Please fill in all password fields");
        return;
      }

      if (values.newPassword !== values.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }

      if (values.newPassword.length < 6) {
        toast.error("New password must be at least 6 characters long");
        return;
      }

      const passwordData = {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      };

      dispatch(changePassword(passwordData));
    },
  });

  //------------------FUNCTIONS------------------------------//

  function createTabs() {
    const tabInfo = [
      {
        label: "Name",
        content: (
          <Paper
            elevation={3}
            style={{
              padding: 0,
              maxWidth: "600px",
              border: "0px solid black",
              minHeight: "200px",
            }}
          >
            <Box
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              p={4}
              pt={3}
            >
              <form onSubmit={formik.handleSubmit}>
                <TextField
                  fullWidth
                  id="firstName"
                  name="firstName"
                  label="First Name"
                  autoComplete="off"
                  border="10px solid"
                  value={formik.values.firstName}
                  onChange={formik.handleChange}
                  error={
                    formik.touched.firstName && Boolean(formik.errors.firstName)
                  }
                  helperText={
                    formik.touched.firstName && formik.errors.firstName
                  }
                />

                <TextField
                  fullWidth
                  id="lastName"
                  name="lastName"
                  autoComplete="off"
                  label="Last Name"
                  value={formik.values.lastName}
                  onChange={formik.handleChange}
                  error={
                    formik.touched.lastName && Boolean(formik.errors.lastName)
                  }
                  helperText={formik.touched.lastName && formik.errors.lastName}
                />

                <br />
                <br />

                <Button
                  color="primary"
                  variant="contained"
                  fullWidth
                  type="submit"
                >
                  Update
                </Button>
              </form>
            </Box>
          </Paper>
        ),
      },
      {
        label: "Email",
        content: (
          <Paper
            elevation={3}
            style={{
              padding: 0,
              maxWidth: "600px",
              minWidth: "300px",
              border: "0px solid black",
              minHeight: "200px",
            }}
          >
            <Box
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              p={4}
              pt={4}
            >
              <form onSubmit={formik.handleSubmit}>
                <TextField
                  fullWidth
                  id="email"
                  name="email"
                  label="Email"
                  style={{ width: 300 }}
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                />

                <br />
                <br />

                <Button
                  color="primary"
                  variant="contained"
                  fullWidth
                  type="submit"
                >
                  Update
                </Button>
              </form>
            </Box>
          </Paper>
        ),
      },
      {
        label: "Password",
        content: (
          <Paper
            elevation={3}
            style={{
              padding: 0,
              maxWidth: "600px",
              border: "0px solid black",
              minHeight: "280px",
            }}
          >
            <Box
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              p={4}
              pt={2}
            >
              <form onSubmit={passwordFormik.handleSubmit} autoComplete={"off"}>
                <TextField
                  fullWidth
                  id="currentPassword"
                  name="currentPassword"
                  label="Current Password"
                  type="password"
                  autoComplete={"off"}
                  value={passwordFormik.values.currentPassword}
                  onChange={passwordFormik.handleChange}
                  error={
                    passwordFormik.touched.currentPassword &&
                    Boolean(passwordFormik.errors.currentPassword)
                  }
                  helperText={
                    passwordFormik.touched.currentPassword &&
                    passwordFormik.errors.currentPassword
                  }
                  style={{ marginBottom: "16px" }}
                />

                <TextField
                  fullWidth
                  id="newPassword"
                  name="newPassword"
                  label="New Password"
                  type="password"
                  autoComplete={"off"}
                  value={passwordFormik.values.newPassword}
                  onChange={passwordFormik.handleChange}
                  error={
                    passwordFormik.touched.newPassword &&
                    Boolean(passwordFormik.errors.newPassword)
                  }
                  helperText={
                    passwordFormik.touched.newPassword &&
                    passwordFormik.errors.newPassword
                  }
                  style={{ marginBottom: "16px" }}
                />

                <TextField
                  fullWidth
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirm New Password"
                  type="password"
                  autoComplete="off"
                  value={passwordFormik.values.confirmPassword}
                  onChange={passwordFormik.handleChange}
                  error={
                    passwordFormik.touched.confirmPassword &&
                    Boolean(passwordFormik.errors.confirmPassword)
                  }
                  helperText={
                    passwordFormik.touched.confirmPassword &&
                    passwordFormik.errors.confirmPassword
                  }
                />

                <br />
                <br />

                <Button
                  color="primary"
                  variant="contained"
                  fullWidth
                  type="submit"
                  disabled={isLoading}
                >
                  Change Password
                </Button>
              </form>
            </Box>
          </Paper>
        ),
      },
    ];

    const tabs = [];

    for (let i = 0; i < tabCount; i++) {
      tabs.push({
        tabLabel: tabInfo[i].label,
        tabContent: tabInfo[i].content,
      });
    }

    return tabs;
  }

  //------------------USE EFFECT------------------//

  // Clear password form on page reload or invalid Password
  useEffect(() => {
    passwordFormik.setValues({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  }, []);

  useEffect(() => {
    if (isError) {
      console.log(message);
    }
  }, [isError, message, dispatch]);

  // Handle update user success (for name and email updates)
  useDidMountEffect(() => {
    if (isSuccess && !changePasswordSuccess) {
      toast.success("Successfully updated!");
    }
  }, [isSuccess, changePasswordSuccess]);

  // Handle password change success
  useDidMountEffect(() => {
    if (changePasswordSuccess && changePasswordMessage) {
      toast.success(changePasswordMessage);
      passwordFormik.resetForm();
      dispatch(resetPasswordState());
    }
  }, [changePasswordSuccess, changePasswordMessage]);

  // Handle password change errors specifically
  useDidMountEffect(() => {
    if (changePasswordError) {
      toast.error(changePasswordError);
      passwordFormik.resetForm();
      dispatch(resetPasswordState());
    }
  }, [changePasswordError]);

  // Handle immediate errors
  useEffect(() => {
    if (changePasswordError) {
      // Clear password form on any error
      passwordFormik.setValues({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      // Clear any form validation errors
      passwordFormik.setErrors({});
      passwordFormik.setTouched({});
    }
  }, [changePasswordError]);

  //------------

  if (isLoading) {
    return <Spinner />;
  }

  //----------------------RENDER----------------------//

  return (
    <Box display="flex" width="100%" m={3}>
      <Container maxWidth="md">
        <GridLegacy container spacing={2}>
          <GridLegacy
            item
            xs={12}
            sm={12}
            md={12}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TabsBasic tabs={createTabs()} />
          </GridLegacy>
        </GridLegacy>
      </Container>
    </Box>
  );
};

export default QMAccountDetails;
