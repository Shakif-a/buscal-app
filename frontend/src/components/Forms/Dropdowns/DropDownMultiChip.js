import * as React from "react";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTheme } from "@mui/material/styles";
import Chip from "@mui/material/Chip";
import OutlinedInput from "@mui/material/OutlinedInput";
import Box from "@mui/material/Box";
import InputLabel from "@mui/material/InputLabel";

// Constants for Chip Multi-Select Dropdown styling
const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

// Function to determine styles for each option in the dropdown
function getStyles(name, getter, theme) {
  return {
    fontWeight:
      getter.indexOf(name) === -1
        ? theme.typography.fontWeightRegular
        : theme.typography.fontWeightMedium,
  };
}

// Dropdown component with multiple chip selection
export default function DropDownMultiChip({
  dropDownLabel, // Label for the dropdown
  getter, // Selected values from the dropdown
  setter, // Function to set the selected values
  list, // List of options for the dropdown
  minWidth, // Optional prop for minimum width of the dropdown
  maxWidth, // Optional prop for maximum width of the dropdown
}) {
  // Get the current theme
  const theme = useTheme();

  // Handler for changing selected values
  const handleSetter = (event) => {
    setter(event.target.value);
  };

  return (
    <>
      {/* Label for the dropdown */}
      <InputLabel id="demo-multiple-chip-label">{dropDownLabel}</InputLabel>

      {/* Actual Select component for the dropdown */}
      <Select
        labelId="demo-multiple-chip-label"
        id="demo-multiple-chip"
        multiple
        value={getter}
        onChange={handleSetter}
        input={<OutlinedInput id="select-multiple-chip" label="Chip" />}
        renderValue={(selected) => (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 0.5,
              width: "100%",
              backgroundColor: "white",
            }}
          >
            {/* Render selected options as Chips */}
            {selected.map((value) => (
              <Chip key={value} label={value} style={{ margin: "2px" }} />
            ))}
          </Box>
        )}
        MenuProps={MenuProps}
        sx={{ width: "100%", backgroundColor: "white", minWidth, maxWidth }}
      >
        {/* Render options in the dropdown */}
        {list.map((name, length) => (
          <MenuItem
            key={length}
            value={name}
            style={getStyles(name, getter, theme)}
          >
            {name}
          </MenuItem>
        ))}
      </Select>
    </>
  );
}
