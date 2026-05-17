import React from "react";
import { Card, CardMedia, Typography } from "@mui/material";

const LinkCard = ({ link, image, title }) => {
  const handleCardClick = () => {
    window.location.href = link;
  };

  return (
    <Card
      sx={{
        boxShadow: 3,
        cursor: "pointer",
        maxWidth: 300,
        height: 80,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        "&:hover": {
          transform: "scale(1.02)",
          transition: "transform 0.2s ease-in-out",
        },
      }}
      onClick={handleCardClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <CardMedia
          component="img"
          image={image}
          alt=""
          sx={{
            width: 40,
            height: 40,
            objectFit: "contain",
            backgroundColor: "rgba(255, 255, 255, 0.5)",
          }}
        />
        <Typography
          variant="body1"
          sx={{
            color: "#1A237E",
            fontWeight: 500,
            fontSize: "1rem",
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
      </div>
    </Card>
  );
};

export default LinkCard;
