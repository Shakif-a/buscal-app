/**
 * HomePage.js — Business Calendar standalone repo
 *
 * Trimmed dashboard homepage showing only Business Calendar and Settings.
 * Add OKR (or other new modules) by appending to cardData below.
 */
import React from "react";
import { useSelector } from "react-redux";
import Nav from "../navigation/Nav";
import EmployeeDashboardContent from "../dashboard/EmployeeDashboardContent";

export default function HomePage() {
  return <Nav main={[<EmployeeDashboardContent />]} />;
}
