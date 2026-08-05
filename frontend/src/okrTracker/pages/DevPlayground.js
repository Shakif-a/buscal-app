import React from "react";
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";

export default function DevPlayground() {

  const runTest1 = () => {
    console.log("Test1 Done!")
  }

  const runTest2 = () => {
    console.log("Test2 Done!")
  }

  return (
    <Container maxWidth="md">
      <Box py={5} spacing={3}>
        <Typography variant="h5">Dev Playground</Typography>
        <Stack>
          <Button variant="contained" onClick={runTest1}>Test1</Button>
          <Button variant="contained" onClick={runTest2}>Test2</Button>
        </Stack>
        <TextField lable="Objective Name" variant="outlined"></TextField>
      </Box>
    </Container>
  )
}