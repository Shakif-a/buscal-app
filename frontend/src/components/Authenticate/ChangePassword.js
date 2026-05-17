import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { changePassword, reset } from "../../features/auth/authSlice";
import Spinner from "../Spinner";
import {
  Container,
  GridLegacy,
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
} from "@mui/material";
import { FaLock } from "react-icons/fa";

function ChangePassword() {
  const dispatch = useDispatch();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const { currentPassword, newPassword, confirmPassword } = formData;

  const { isLoading, isError, isSuccess, message, changePasswordMessage } =
    useSelector((state) => state.auth);

  const onChange = (e) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    const passwordData = {
      currentPassword,
      newPassword,
      confirmPassword,
    };

    dispatch(changePassword(passwordData));
  };

  useEffect(() => {
    if (isError) {
      toast.error(message);
    }

    if (isSuccess && changePasswordMessage) {
      toast.success(changePasswordMessage);
      // Clear the form
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }

    dispatch(reset());
  }, [isError, isSuccess, message, changePasswordMessage, dispatch]);

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <Container maxWidth="sm">
      <Card sx={{ mt: 2, mb: 2 }}>
        <CardContent>
          <Box textAlign="center" mb={3}>
            <FaLock size={32} color="#3f51b5" />
            <Typography variant="h5" component="h2" gutterBottom>
              Change Password
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Enter your current password and choose a new one
            </Typography>
          </Box>
          <Box
            component="form"
            onSubmit={onSubmit}
            sx={{ width: "100%", mt: 1 }}
          >
            <GridLegacy container spacing={2}>
              <GridLegacy item xs={12}>
                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  name="currentPassword"
                  id="currentPassword"
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={onChange}
                  autoComplete="current-password"
                />
              </GridLegacy>

              <GridLegacy item xs={12}>
                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  name="newPassword"
                  id="newPassword"
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={onChange}
                  autoComplete="new-password"
                />
              </GridLegacy>

              <GridLegacy item xs={12}>
                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  name="confirmPassword"
                  id="confirmPassword"
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={onChange}
                  autoComplete="new-password"
                />
              </GridLegacy>
            </GridLegacy>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              Change Password
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

export default ChangePassword;
