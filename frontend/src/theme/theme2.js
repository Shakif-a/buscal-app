import { createTheme } from "@mui/material/styles";

const theme2 = createTheme({
  status: {
    danger: "#e53e3e",
  },
  palette: {
    primary: {
      main: "#0971f1",
      dark: "#1A237E",
      darker: "#053e85",
    },
    neutral: {
      main: "#64748B",
      contrastText: "#fff",
    },
    primary1: {
      main: "#1A237E",
    },
    primary2: {
      main: "#304FFE",
    },
    primary3: {
      main: "#536DFE",
    },
    secondary1: {
      main: "#ff8f00",
    },
    secondary2: {
      main: "#FFAB00",
    },
    secondary3: {
      main: "#ffd740",
    },
    text1: "#1A237E",
    text2: "#5C6BC0",
    text3: "#9FA8DA",
  },
});

export default theme2;
