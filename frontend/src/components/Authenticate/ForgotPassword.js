import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { forgotPassword, reset } from "../../features/auth/authSlice";
import Spinner from "../Spinner";
import { Container, Box, Typography, Button, TextField } from "@mui/material";
import Header from "./Header";
import { FaKey } from "react-icons/fa";

// Centering handled with responsive sx below

export default function ForgotPassword(props) {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const content = {
    "02_header": "Reset Your Password",
    "02_description":
      "Enter your email address and we'll send you a link to reset your password.",
    "02_primary-action": "Send Reset Link",
    "02_secondary-action": "Back to Login",
    ...props.content,
  };

  const [email, setEmail] = useState("");

  const { isLoading, isError, isSuccess, message, forgotPasswordMessage } =
    useSelector((state) => state.auth);

  const onSubmit = (e) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    dispatch(forgotPassword(email));
  };

  useEffect(() => {
    if (isError) {
      console.error("Forgot password error:", message);
      toast.error(message || "An error occurred while sending reset email");
    }

    if (isSuccess && forgotPasswordMessage) {
      console.log("Forgot password success:", forgotPasswordMessage);
      toast.success(forgotPasswordMessage);
      setEmail("");
    }

    dispatch(reset());
  }, [isError, isSuccess, message, forgotPasswordMessage, dispatch]);

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div className="container">
      <Header />

      <section>
        <Container maxWidth="xs">
          <Box pt={3} pb={10}>
            <Box mb={3} textAlign="center">
              <section className="heading">
                <h1>
                  <center>
                    <FaKey />
                    Forgot Password
                  </center>
                </h1>
              </section>
              <Typography variant="h5" component="h2">
                {content["02_header"]}
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                style={{ marginTop: "16px" }}
              >
                {content["02_description"]}
              </Typography>
            </Box>

            <Box>
              <form onSubmit={onSubmit}>
                <TextField
                  variant="outlined"
                  required
                  fullWidth
                  name="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  label="Email address"
                  autoComplete="email"
                  style={{ backgroundColor: "white", marginBottom: "16px" }}
                />

                <Box my={2}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                    disabled={isLoading}
                  >
                    {content["02_primary-action"]}
                  </Button>
                </Box>

                <Box sx={{ textAlign: { xs: "left", sm: "center" } }}>
                  <Link to="/login" variant="body2">
                    {content["02_secondary-action"]}
                  </Link>
                </Box>
              </form>
            </Box>
          </Box>
        </Container>
      </section>
    </div>
  );
}
