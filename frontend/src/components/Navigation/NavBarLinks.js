import * as React from "react";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { Link as MuiLink } from "react-router-dom";

const NavBarLinks = ({ content, length }) => {
  return (
    <>
      <ListItemButton
        component={MuiLink}
        to={content.route[length]}
        key={length}
        className="navBarListItem"
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          {content.icon[length]}
        </ListItemIcon>
        <ListItemText primary={content.name[length]} />
      </ListItemButton>
    </>
  );
};

export default NavBarLinks;
