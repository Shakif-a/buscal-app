import React from "react";
import {
  Container,
  GridLegacy,
  Box,
  Link,
  Button,
  TextField,
} from "@mui/material";
import { FaUser } from "react-icons/fa";
import { register, reset } from "../../features/auth/authSlice";
import Spinner from "../Spinner";
import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Header from "./Header";

export default function Register(props) {
  //----------------------------CONSTS----------------------------

  const content = {
    brand: { image: "mui-assets/img/logo-pied-piper-icon.png", width: 40 },
    header: "Create a new account",
    terms: "I agree to the terms of use and privacy policy.",
    "01_primary-action": "Sign up",
    "01_secondary-action": "Already have an account? Sign in",
    ...props.content,
  };

  // let brand;

  // if (content.brand.image) {
  //   brand = <img src={ content.brand.image } alt="" width={ content.brand.width } />;
  // } else {
  //   brand = content.brand.text || '';
  // }

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    password2: "",
    type: "pending",
  });

  const { firstName, lastName, email, password, password2, type } = formData;

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user, isLoading, isError, isSuccess, message } = useSelector(
    (state) => state.auth
  );

  //----------------------------USE EFFECT----------------------------

  useEffect(() => {
    if (isError) {
      toast.error(message);
    }

    if (isSuccess || user) {
      navigate("/");
    }

    dispatch(reset());
  }, [user, isError, isSuccess, message, navigate, dispatch]);

  const onChange = (e) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();

    if (password !== password2) {
      toast.error("Passwords do not match");
    } else {
      const userData = {
        firstName,
        lastName,
        email,
        password,
        type,
      };

      dispatch(register(userData));
    }
  };

  if (isLoading) {
    return <Spinner />;
  }

  //----------------------------MAIN----------------------------

  return (
    <div className="container">
      <Header />

      <section>
        <Container maxWidth="xs">
          <Box pt={3} pb={10}>
            <Box mb={3} textAlign="center">
              <section className="heading">
                <div className="center">
                  <h1>
                    <FaUser />
                  </h1>
                </div>
                Register
              </section>
            </Box>

            <Box>
              <form onSubmit={onSubmit}>
                <GridLegacy container spacing={2}>
                  <GridLegacy item xs={12} sm={6}>
                    <TextField
                      variant="outlined"
                      required
                      fullWidth
                      autoComplete="fname"
                      name="firstName"
                      id="firstName"
                      label="First name"
                      style={{ backgroundColor: "white" }}
                      value={firstName}
                      onChange={onChange}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12} sm={6}>
                    <TextField
                      variant="outlined"
                      required
                      fullWidth
                      name="lastName"
                      id="lastName"
                      label="Last name"
                      autoComplete="lname"
                      style={{ backgroundColor: "white" }}
                      value={lastName}
                      onChange={onChange}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <TextField
                      variant="outlined"
                      required
                      fullWidth
                      name="email"
                      id="email"
                      label="Email address"
                      autoComplete="email"
                      style={{ backgroundColor: "white" }}
                      value={email}
                      onChange={onChange}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <TextField
                      variant="outlined"
                      required
                      fullWidth
                      name="password"
                      id="password"
                      label="Password"
                      type="password"
                      autoComplete="current-password"
                      style={{ backgroundColor: "white" }}
                      value={password}
                      onChange={onChange}
                    />
                  </GridLegacy>

                  <GridLegacy item xs={12}>
                    <TextField
                      variant="outlined"
                      required
                      fullWidth
                      name="password2"
                      id="password2"
                      label="Confirm Password"
                      type="password"
                      style={{ backgroundColor: "white" }}
                      value={password2}
                      onChange={onChange}
                    />
                  </GridLegacy>
                </GridLegacy>

                <Box my={2}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    color="primary"
                  >
                    {content["01_primary-action"]}
                  </Button>
                </Box>

                <Box textAlign="right">
                  <Link href="/login" variant="body2">
                    {content["01_secondary-action"]}
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
