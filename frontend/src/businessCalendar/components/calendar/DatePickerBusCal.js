import * as React from "react";
import dayjs from "dayjs";
import Stack from "@mui/material/Stack";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { FormHelperText } from "@mui/material";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/en-gb";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("en-gb");

export default function DatePickerBusCal({
  setDate,
  label,
  value,
  disabled = false,
  helperText = "", // Added helperText prop with a default value
}) {
  // Convert to Date object
  const parsedValue = value ? dayjs.tz(value, "Australia/Sydney") : null;

  const handleChange = (newValue) => {
    var newDate = newValue.toDate();
    setDate(newDate);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
      <Stack spacing={2}>
        <DateTimePicker
          label={label}
          value={parsedValue}
          onChange={handleChange}
          disabled={disabled}
          slotProps={{ textField: { variant: "outlined" } }}
        />
        {helperText && <FormHelperText>{helperText}</FormHelperText>}{" "}
        {/* Conditionally render helper text */}
      </Stack>
    </LocalizationProvider>
  );
}
