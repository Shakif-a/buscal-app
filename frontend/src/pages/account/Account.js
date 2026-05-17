import * as React from "react";
import { useSelector } from "react-redux";
import { Container } from "@mui/material";
import { Box } from "@mui/system";
import QMAccountHeader from "./QMAccountHeader";

export default function Account({}) {
  //------------------ATTRIBUTES/VARIABLES------------------

  const { user } = useSelector((state) => state.auth);

  //------------------FUNCTIONS------------------

  //------------

  function setPage() {
    if (user.roles.includes("employee")) {
      return <QMAccountHeader />;
    } else if (user.roles.includes("qm")) {
      return <QMAccountHeader />;
    }
  }

  //------------------RETURN RENDER------------------

  return (
    <Container maxWidth="lg">
      <Box m={0}>{setPage()}</Box>
    </Container>
  );
}
