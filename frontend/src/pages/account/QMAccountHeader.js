import React from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import GridLegacy from "@mui/material/GridLegacy";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardMedia from "@mui/material/CardMedia";
import Button from "@mui/material/Button";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

export default function QMAccountHeader(props) {
  const { user } = useSelector((state) => state.auth);

  return (
    <section>
      <Container maxWidth="lg">
        <Box py={3}>
          <GridLegacy container spacing={8}>
            <GridLegacy item xs={12} md={6}>
              <Box display="flex" height="100%">
                <Box my="auto">
                  <Typography variant="h3" component="h3" gutterBottom>
                    <Typography color="primary" variant="h3" component="span" />
                    <Typography variant="h3" component="span">
                      Configure Dashboard
                    </Typography>
                  </Typography>

                  <Typography
                    variant="subtitle1"
                    color="textSecondary"
                    paragraph
                  >
                    Update your account details.
                  </Typography>

                  <Box mt={3}>
                    <Button
                      variant="contained"
                      color="secondary2"
                      component={Link}
                      to="/dashboard/settings/details"
                      sx={{
                        m: 0,
                        boxShadow: 3,
                        minWidth: "250px",
                        "&:hover": { bgcolor: "#ff8f00" },
                      }}
                    >
                      Account Details
                    </Button>
                  </Box>

                  <Box mt={3}>
                    <Button
                      variant="contained"
                      color="secondary2"
                      component={Link}
                      to="/dashboard/settings/manage"
                      sx={{
                        m: 0,
                        boxShadow: 3,
                        minWidth: "250px",
                        "&:hover": { bgcolor: "#ff8f00" },
                      }}
                    >
                      Manage accounts
                    </Button>
                  </Box>
                </Box>
              </Box>
            </GridLegacy>

            <GridLegacy item xs={12} md={6}>
              <Card>
                <CardMedia
                  image="https://images.pexels.com/photos/6893329/pexels-photo-6893329.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
                  sx={{
                    height: 0,
                    paddingTop: "56.25%",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </Card>
            </GridLegacy>
          </GridLegacy>
        </Box>
      </Container>
    </section>
  );
}