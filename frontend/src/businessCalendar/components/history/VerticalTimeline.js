import React, { useState } from "react";
import { Timeline, Button } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";

const VerticalTimeline = ({ data }) => {
  // State to manage the reverse chronological order of the timeline
  const [reverse, setReverse] = useState(false);
  // Function to handle the arrow button click and toggle reverse state
  const handleArrowClick = () => {
    setReverse(!reverse);
  };
  // Function to determine the colour based on the type of timeline item
  const getColorByType = (type) => {
    switch (type) {
      case "assignment":
        return "rgb(84, 245, 81)"; // green
      case "reassignment":
        return "rgb(5, 107, 65)"; // dark green
      case "escalation":
        return "rgb(245, 51, 77)"; // red
      case "notification":
        return "rgb(89, 172, 255)"; // blue
      case "completionChange":
        return "rgb(153, 51, 255)"; // purple
      case "edit":
        return "rgb(230, 168, 0)"; // yellow
      default:
        return "rgb(0, 0, 0)"; // default color
    }
  };
  // Transform the input data array into timeline items with desired properties
  const items = data.map((item) => {
    return {
      color: getColorByType(item.type),
      label: item.timestamp,
      children: (
        <>
          <p>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}{" "}
            {["assignment", "notification"].includes(item.type) ? "to" : "by"}{" "}
            {item.user.charAt(0).toUpperCase() + item.user.slice(1)}
          </p>
          <p>{item.notes}</p>
        </>
      ),
    };
  });

  return (
    <>
      <Button
        type="default"
        icon={reverse ? <DownOutlined /> : <UpOutlined />}
        onClick={handleArrowClick}
        style={{ marginBottom: 20 }}
      ></Button>
      <Timeline reverse={reverse} mode="left" items={items} />
    </>
  );
};

export default VerticalTimeline;
