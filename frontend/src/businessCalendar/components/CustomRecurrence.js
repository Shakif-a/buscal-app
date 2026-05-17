import React, { useState } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import RadioGroup from "@mui/material/RadioGroup";
import Radio from "@mui/material/Radio";

const CustomRecurrence = () => {
  const [repeatNumber, setRepeatNumber] = useState(1);
  const [repeatType, setRepeatType] = useState("day");
  const [selectedDays, setSelectedDays] = useState([]);
  const [radioOption, setRadioOption] = useState("date");
  const [radioOption2, setRadioOption2] = useState("date");
  const [date, setDate] = useState("1");
  const [order, setOrder] = useState("first");
  const [day, setDay] = useState("Monday");
  const [month, setMonth] = useState("January");

  const handleNumberChange = (event) => {
    setRepeatNumber(event.target.value);
  };

  const handleTypeChange = (event) => {
    setRepeatType(event.target.value);
  };

  const handleDayChange = (event) => {
    setSelectedDays(event.target.value);
  };

  const handleRadioOptionChange = (event) => {
    setRadioOption(event.target.value);
  };
  const handleRadioOptionChange2 = (event) => {
    setRadioOption2(event.target.value);
  };

  return (
    <Box
      display="grid"
      gridTemplateColumns="1fr 1fr"
      gridTemplateRows="1fr 2fr 2fr 2fr"
      gap="5px"
    >
      {/* Box 1 - Top row*/}
      <Box
        gridColumn="1 / 3"
        gridRow="1 / 2"
        height="100%"
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        paddingLeft="10px"
      >
        <span style={{ marginRight: "10px" }}>Repeat every</span>
        <FormControl variant="standard" style={{ width: "auto" }}>
          <Select value={repeatNumber} onChange={handleNumberChange}>
            {[...Array(20).keys()].map((number) => (
              <MenuItem key={number + 1} value={number + 1}>
                {number + 1}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl
          variant="standard"
          style={{ marginLeft: "10px", width: "auto" }}
        >
          <Select value="day">
            {["day", "week", "month", "year"].map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Box 2 - Days of week */}
      <Box gridColumn="1 / 3" gridRow="2 / 3" bgcolor="yellow" height="100%">
        <FormControl
          fullWidth
          variant="standard"
          style={{ marginBottom: "16px" }}
        >
          <InputLabel>Select days</InputLabel>
          <Select multiple value={selectedDays} onChange={handleDayChange}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <MenuItem key={day} value={day}>
                {day}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Box 3 - Month options*/}
      <Box gridColumn="1 / 3" gridRow="3 / 4" bgcolor="yellow" height="100%">
        <FormControl component="fieldset" style={{ marginBottom: "16px" }}>
          <RadioGroup value={radioOption} onChange={handleRadioOptionChange}>
            <FormControlLabel
              value="date"
              control={<Radio />}
              label={`On day ${date}`}
            />
            <FormControlLabel
              value="orderDay"
              control={<Radio />}
              label={`On ${order} ${day}`}
            />
          </RadioGroup>
        </FormControl>
      </Box>

      {/* Box 4 - Year options */}
      <Box gridColumn="1 / 3" gridRow="4 / 5" bgcolor="orange" height="100%">
        <FormControl component="fieldset">
          <RadioGroup value={radioOption2} onChange={handleRadioOptionChange2}>
            <FormControlLabel
              value="monthDate"
              control={<Radio />}
              label={`On ${month} ${date}`}
            />
            <FormControlLabel
              value="orderDayMonth"
              control={<Radio />}
              label={`On ${order} ${day} of ${month}`}
            />
          </RadioGroup>
        </FormControl>
      </Box>
    </Box>
  );
};

export default CustomRecurrence;
