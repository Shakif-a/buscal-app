import React from "react";
import Tree from "react-d3-tree";
import { Box, Container, Typography } from "@mui/material";

const OrgTree = ({ data }) => {
  const renderRectSvgNode = ({ nodeDatum }) => {
    return (
      <g>
        <foreignObject {...foreignObjectProps}>
          <Container>
            <Box
              sx={{
                border: "0.1px solid black", // Thin black border
                borderRadius: "0.1px", // Rounded corners
                padding: "2px", // Padding
              }}
            >
              <Box
                sx={{
                  border: "0.1px solid white", // Thick white border
                  backgroundColor: "#0976BC", // Background color
                  padding: "3px", // Padding inside the white border
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="h6"
                  style={{
                    textTransform: "uppercase",
                    color: "white",
                    fontWeight: "bold",
                    textAlign: "center",
                  }}
                >
                  {nodeDatum.name}
                </Typography>
                <Typography
                  variant="h8"
                  style={{
                    textTransform: "uppercase",
                    color: "white",
                    textAlign: "center",
                  }}
                >
                  {nodeDatum.attributes.join(", ")}
                </Typography>
              </Box>
            </Box>
          </Container>
        </foreignObject>
      </g>
    );
  };

  const nodeSize = { x: 300, y: 200 };
  const foreignObjectProps = {
    width: nodeSize.x,
    height: nodeSize.y,
    x: -nodeSize.x / 2,
    y: -60,
  };

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  const centerX = windowWidth / 2;
  const centerY = windowHeight / 10;

  const translate = { x: centerX, y: centerY };

  return (
    <div id="treeWrapper" style={{ width: "100em", height: "100em" }}>
      <Tree
        data={data}
        orientation="vertical"
        pathFunc="step"
        separation={{ nonSiblings: 2, siblings: 2 }}
        collapsible={false}
        translate={translate}
        zoom={0.5}
        renderCustomNodeElement={renderRectSvgNode}
      />
    </div>
  );
};

export default OrgTree;
