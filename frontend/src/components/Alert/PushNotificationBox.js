// import React from "react";
// import { GridLegacy, Box, Typography, styled } from "@mui/material";
// import moment from "moment";

// const MessageTypography = styled(Typography)(({ mode }) => ({
//   fontSize: mode ? "clamp(16px, 4cqi, 26px)" : "1.0em",
//   textAlign: "left",
//   lineHeight: 1.5,
//   wordBreak: "break-word",
//   paddingLeft: mode ? "12px" : "0.5em",
//   paddingRight: mode ? "12px" : "0.5em",
//   display: "inline",
// }));

// const TimestampTypography = styled(Typography)(({ mode }) => ({
//   fontSize: mode ? "clamp(14px, 3cqi, 20px)" : "0.85em",
//   color: "gray",
//   marginRight: mode ? "12px" : "0.5em",
// }));

// const NotificationWrapper = styled(Box, {
//   shouldForwardProp: (prop) =>
//     prop !== "isLink" && prop !== "categoryColor" && prop !== "mode",
// })(({ isLink, categoryColor, status, mode }) => ({
//   width: "100%",
//   borderTop: mode ? "2px solid black" : "1px solid black",
//   borderBottom: mode ? "2px solid black" : "1px solid black",
//   display: "flex",
//   minHeight: mode ? "100px" : "40px",
//   position: "relative",
//   boxSizing: "border-box",
//   transition: "all 0.2s ease-in-out",
//   backgroundColor:
//     status === "unread" ? "rgba(222, 239, 250, 0.6)" : "transparent",

//   ...(isLink && {
//     cursor: "pointer",
//     "&:hover": {
//       backgroundColor: "rgba(0, 0, 0, 0.04)",
//       "& .colorTab": {
//         width: mode ? "18px" : "14px",
//       },
//     },
//     "&:active": {
//       backgroundColor: "rgba(0, 0, 0, 0.08)",
//     },
//   }),
// }));

// const PushNotificationBox = ({
//   message,
//   timestamp,
//   category,
//   link,
//   status,
//   mode = true, // New mode prop with default value
// }) => {
//   const categoryColors = {
//     cia: "#2196F3",
//     vms: "#FF9800",
//     calendar: "#4CAF50",
//     error: "#F44336",
//   };
//   const color = categoryColors[category] || "#000000";
//   const formattedTimestamp = moment(timestamp).format("hh:mm A, DD/MM/YY");

//   const handleClick = () => {
//     if (link) {
//       window.open(link, "_blank", "noopener,noreferrer");
//     }
//   };

//   return (
//     <NotificationWrapper
//       isLink={!!link}
//       categoryColor={color}
//       onClick={handleClick}
//       status={status}
//       role={link ? "link" : "article"}
//       aria-label={link ? "Click to open link" : undefined}
//       mode={mode}
//     >
//       <Box
//         className="colorTab"
//         sx={{
//           width: mode ? "14px" : "10px",
//           position: "absolute",
//           left: 0,
//           top: 0,
//           bottom: 0,
//           backgroundColor: color,
//           transition: "width 0.2s ease-in-out",
//         }}
//       />
//       <GridLegacy
//         container
//         spacing={1}
//         sx={{
//           pl: mode ? "24px" : "15px",
//           py: mode ? 2 : 1,
//           flex: 1,
//         }}
//       >
//         <GridLegacy item xs={mode ? 11 : 10}>
//           <MessageTypography
//             variant="body1"
//             dangerouslySetInnerHTML={{ __html: message }}
//             mode={mode}
//           />
//           {link && (
//             <Typography
//               variant="body2"
//               sx={{
//                 color: "primary.main",
//                 fontSize: mode
//                   ? "clamp(13px, 3cqi, 18px)"
//                   : "clamp(11px, 2cqi, 16px)",
//                 mt: 0.5,
//                 pl: mode ? 1.5 : 1.25,
//                 opacity: 0.7,
//               }}
//               style={{ display: "inline" }}
//             >
//               ↗
//             </Typography>
//           )}
//         </GridLegacy>

//         {status === "unread" && (
//           <GridLegacy item xs={1}>
//             <Typography
//               variant="caption"
//               sx={{
//                 backgroundColor: "#f05151",
//                 color: "#FFFFFF",
//                 borderRadius: "3px",
//                 padding: mode ? "3px 6px" : "2px 5px",
//                 marginLeft: mode ? "6px" : "0px",
//                 fontSize: mode ? "clamp(9px, 2.5cqi, 14px)" : "0.7em",
//                 fontWeight: 700,
//               }}
//             >
//               NEW
//             </Typography>
//           </GridLegacy>
//         )}
//         {mode === false ? (
//           <GridLegacy item xs={1}>
//             <br />
//           </GridLegacy>
//         ) : null}

//         <GridLegacy
//           item
//           xs={12}
//           sx={{ display: "flex", justifyContent: "flex-end" }}
//         >
//           <TimestampTypography variant="body2" mode={mode}>
//             {formattedTimestamp}
//           </TimestampTypography>
//         </GridLegacy>
//       </GridLegacy>
//     </NotificationWrapper>
//   );
// };

// export default PushNotificationBox;


import React from "react";
import { GridLegacy, Box, Typography, styled } from "@mui/material";
import moment from "moment";

const MessageTypography = styled(Typography)(({ mode }) => ({
  fontSize: mode ? "clamp(16px, 4cqi, 26px)" : "1.0em",
  textAlign: "left",
  lineHeight: 1.5,
  wordBreak: "break-word",
  paddingLeft: mode ? "12px" : "0.5em",
  paddingRight: mode ? "12px" : "0.5em",
  display: "inline",
}));

const TimestampTypography = styled(Typography)(({ mode }) => ({
  fontSize: mode ? "clamp(14px, 3cqi, 20px)" : "0.85em",
  color: "gray",
  marginRight: mode ? "12px" : "0.5em",
}));

const NotificationWrapper = styled(Box, {
  shouldForwardProp: (prop) =>
    prop !== "isLink" && prop !== "categoryColor" && prop !== "mode",
})(({ isLink, status, mode }) => ({
  width: "100%",
  borderTop: mode ? "2px solid black" : "1px solid black",
  borderBottom: mode ? "2px solid black" : "1px solid black",
  display: "flex",
  minHeight: mode ? "100px" : "40px",
  position: "relative",
  boxSizing: "border-box",
  transition: "all 0.2s ease-in-out",
  backgroundColor:
    status === "unread" ? "rgba(222, 239, 250, 0.6)" : "transparent",

  ...(isLink && {
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "rgba(0, 0, 0, 0.04)",
      "& .colorTab": {
        width: mode ? "18px" : "14px",
      },
    },
    "&:active": {
      backgroundColor: "rgba(0, 0, 0, 0.08)",
    },
  }),
}));

const PushNotificationBox = ({
  message,
  timestamp,
  category,
  link,
  status,
  mode = true,
  onClick,
}) => {
  const categoryColors = {
    cia: "#2196F3",
    vms: "#FF9800",
    calendar: "#4CAF50",
    error: "#F44336",
    newsletter: "#9C27B0",
    rma: "#795548",
  };

  const color = categoryColors[category] || "#000000";
  const formattedTimestamp = timestamp
    ? moment(timestamp).format("hh:mm A, DD/MM/YY")
    : "";

  const handleClick = async () => {
    // Let parent component mark as read first
    if (onClick) {
      await onClick();
      return;
    }

    // Fallback for places where PushNotificationBox is used without parent handler
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <NotificationWrapper
      isLink={!!link || !!onClick}
      categoryColor={color}
      onClick={handleClick}
      status={status}
      role={link || onClick ? "link" : "article"}
      aria-label={link || onClick ? "Click to open notification" : undefined}
      mode={mode}
    >
      <Box
        className="colorTab"
        sx={{
          width: mode ? "14px" : "10px",
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: color,
          transition: "width 0.2s ease-in-out",
        }}
      />

      <GridLegacy
        container
        spacing={1}
        sx={{
          pl: mode ? "24px" : "15px",
          py: mode ? 2 : 1,
          flex: 1,
        }}
      >
        <GridLegacy item xs={mode ? 11 : 10}>
          <MessageTypography
            variant="body1"
            dangerouslySetInnerHTML={{ __html: message }}
            mode={mode}
          />

          {link && (
            <Typography
              variant="body2"
              sx={{
                color: "primary.main",
                fontSize: mode
                  ? "clamp(13px, 3cqi, 18px)"
                  : "clamp(11px, 2cqi, 16px)",
                mt: 0.5,
                pl: mode ? 1.5 : 1.25,
                opacity: 0.7,
              }}
              style={{ display: "inline" }}
            >
              ↗
            </Typography>
          )}
        </GridLegacy>

        {status === "unread" && (
          <GridLegacy item xs={1}>
            <Typography
              variant="caption"
              sx={{
                backgroundColor: "#f05151",
                color: "#FFFFFF",
                borderRadius: "3px",
                padding: mode ? "3px 6px" : "2px 5px",
                marginLeft: mode ? "6px" : "0px",
                fontSize: mode ? "clamp(9px, 2.5cqi, 14px)" : "0.7em",
                fontWeight: 700,
              }}
            >
              NEW
            </Typography>
          </GridLegacy>
        )}

        {mode === false ? (
          <GridLegacy item xs={1}>
            <br />
          </GridLegacy>
        ) : null}

        <GridLegacy
          item
          xs={12}
          sx={{ display: "flex", justifyContent: "flex-end" }}
        >
          <TimestampTypography variant="body2" mode={mode}>
            {formattedTimestamp}
          </TimestampTypography>
        </GridLegacy>
      </GridLegacy>
    </NotificationWrapper>
  );
};

export default PushNotificationBox;
