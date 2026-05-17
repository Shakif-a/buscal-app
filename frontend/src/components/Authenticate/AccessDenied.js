import React from "react";
import { useEffect, useState } from "react";
import { Container, Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import Header from "./Header";

export default function Forbidden(props) {
  // console.log(props)
  const content = {
    code: "403",
    header: "Access Denied",
    description: "You do not have permission to access this page.",
    "primary-action": "Go Back",
    ...props.content,
  };
  // const currentUrl = window.location.pathname; // does not fetch correct (previous) URL

  const [errorURL, setErrorURL] = useState([]);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const errorURL = JSON.parse(localStorage.getItem("errorURL"));
    if (errorURL) {
      setErrorURL(errorURL);
    }
  }, []);

  const goBack = () => navigate(-1);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="container">
      <Header />

      <section>
        <br />
        <Container maxWidth="md">
          <Box pt={8} pb={10} textAlign="center">
            <Typography variant="h1">{content["code"]}</Typography>
            <Typography variant="h4" component="h2" gutterBottom={true}>
              {content["header"]}
            </Typography>
            <br></br>
            <Typography variant="subtitle1" color="textSecondary">
              {errorURL}
            </Typography>
            <Typography variant="h6" color="textSecondary">
              {content["description"]}
            </Typography>
            <Box mt={4}>
              <Button
                variant="contained"
                color="primary"
                onClick={goBack}
                style={{ marginRight: "10px" }}
              >
                {content["primary-action"]}
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Box>
          </Box>
        </Container>
      </section>
    </div>
  );
}
