import * as React from "react";
import { useSelector } from "react-redux";
import { Container } from "@mui/material";
import { Box } from "@mui/system";
import QMAccountDetails from "./QMAccountDetails";

export default function AccountDetails() {
  //------------------ATTRIBUTES/VARIABLES------------------

  const { user } = useSelector((state) => state.auth);

  //------------------FUNCTIONS------------------

  //------------

  function setPage() {
    if (user.roles.includes("employee")) {
      return <QMAccountDetails />;
    } else if (user.roles.includes("qm")) {
      return <QMAccountDetails />;
    }
  }

  //------------------RETURN RENDER------------------

  return (
    <Container maxWidth="lg">
      <Box m={0}>{setPage()}</Box>
    </Container>
  );
}
