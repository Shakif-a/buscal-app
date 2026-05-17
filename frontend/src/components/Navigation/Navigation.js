import * as React from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import GridLegacy from "@mui/material/GridLegacy";

import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as MuiLink, useNavigate, useLocation } from "react-router-dom";

import { useSelector } from "react-redux";
import { useEffect } from "react";
import Menu from "@mui/material/Menu";
import Typography from "@mui/material/Typography";

import MenuNotifications from "./Menu/MenuNotifications";
import NavBarLinks from "./NavBarLinks";
import { dateToAusDate } from "../Helper/Helper";

const styles = {
  root: { display: "flex" },
  appBar: {
    zIndex: (theme) => theme.zIndex.drawer + 1,
    backgroundColor: (theme) => theme.palette.primary.dark,
  },
  toolbar: { minHeight: 70 },
  menuButton: { mr: 1 },
  linkBrand: { lineHeight: 1, mr: "auto" },
  drawerRoot: {
    width: 270,
    flexShrink: 0,
    display: { xs: "none", md: "block" },
  },
  drawerContainer: { pt: 2, pl: 2, pr: 3, width: 270 },
  profile: { display: { xs: "none", sm: "inline-flex" } },
  content: {
    flexGrow: 1,
    backgroundColor: "Snow",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  },
  mainSpacing: { p: 3 },
};

// ✅ NEW: format today's date as DD/MM/YY
function getTodayDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export default function Navigation(props) {
  const [anchorElUser, setAnchorElUser] = React.useState(null);

  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();

  const isKPIScoreboard = location.pathname.includes("/kpi-scoreboard");
  const isRMA = location.pathname.includes("/rma");

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const content = {
    brand: { image: "/images/logo.png", width: 110 },
    "brand-mobile": { image: "/images/logo.png", width: 110 },
    name: [],
    route: [],
    icon: [],
    settings: [],
    settingsLink: [],
    notifications: [],
    notificationsLink: [],
    notificationsIcon: [],
    avatar:
      "https://media.istockphoto.com/photos/businessman-silhouette-as-avatar-or-default-profile-picture-picture-id476085198?b=1&k=20&m=476085198&s=612x612&w=0&h=Ov2YWXw93vRJNKFtkoFjnVzjy_22VcLLXZIcAO25As4=",
    ...props.content,
  };

  let brand = content["brand"].text || "";
  let brandMobile = content["brand-mobile"].text || "";

  if (content["brand"].image) {
    brand = (
      <img src={content["brand"].image} alt="" width={content["brand"].width} />
    );
  }

  if (content["brand-mobile"].image) {
    brandMobile = (
      <img
        src={content["brand-mobile"].image}
        alt=""
        width={content["brand-mobile"].width}
      />
    );
  }

  const buckets = {
    main: Array.isArray(props.bucketMain) ? props.bucketMain : [],
  };

  const [state, setState] = React.useState({ open: false });

  const toggleDrawer = (open) => (event) => {
    if (
      event.type === "keydown" &&
      (event.key === "Tab" || event.key === "Shift")
    ) {
      return;
    }

    setState({ ...state, open });
  };

  return (
    <div style={{ display: "flex" }}>
      <AppBar position="fixed" sx={styles.appBar}>
        <Toolbar sx={styles.toolbar}>
          <IconButton
            edge="start"
            sx={styles.menuButton}
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer(!state.open)}
          >
            <MenuIcon />
          </IconButton>

          <Link
            href="/dashboard"
            color="inherit"
            underline="none"
            variant="h5"
            sx={styles.linkBrand}
          >
            {brand}
          </Link>

          <MenuNotifications
            notifications={content.notifications}
            notificationsIcon={content.notificationsIcon}
            notificationsLink={content.notificationsLink}
          />

          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open settings">
              <IconButton
                onClick={handleOpenUserMenu}
                sx={{ p: 0, ...styles.profile }}
                color="inherit"
              >
                <Avatar
                  alt=""
                  src={content["avatar"]}
                  sx={{ width: 50, height: 50 }}
                />
              </IconButton>
            </Tooltip>

            <Menu
              sx={{ mt: "45px" }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              {content.settings.map((setting, index) => (
                <MuiLink to={content.settingsLink[index]} key={index}>
                  <MenuItem onClick={handleCloseUserMenu}>
                    <Typography textAlign="center">
                      {setting}
                    </Typography>
                  </MenuItem>
                </MuiLink>
              ))}
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer anchor="left" open={state.open} onClose={toggleDrawer(false)}>
        <div
          style={{
            paddingTop: 16,
            paddingLeft: 16,
            paddingRight: 24,
            width: 270,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box mb={1} ml={2} pb={2}>
            <Link href="#" color="primary" underline="none" variant="h5">
              {brandMobile}
            </Link>
          </Box>

          <List sx={{ flexGrow: 1 }}>
            {content.name.map((name, length) => (
              <NavBarLinks
                content={content}
                length={length}
                key={length}
              />
            ))}
          </List>

          <div
            style={{
              marginTop: "auto",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            <b>Today:</b> {getTodayDate()}
          </div>
        </div>
      </Drawer>

      <GridLegacy container style={{ height: "100vh" }} spacing={0}>
        <main
          style={{
            flexGrow: 1,
            backgroundColor: "Snow",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        >
          <Toolbar sx={styles.toolbar} />

          <div style={{ padding: isKPIScoreboard || isRMA ? 0 : 24 }}>
            {buckets["main"].map((component, length) => (
              <React.Fragment key={length}>
                {component}
              </React.Fragment>
            ))}
          </div>
        </main>
      </GridLegacy>
    </div>
  );
}