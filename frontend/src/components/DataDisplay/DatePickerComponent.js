import * as React from "react";
import dayjs from "dayjs";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/en-au";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("en-au");

export default React.memo(function DatePickerComponent({
  setDate,
  label,
  disabled = false,
  value: externalValue = null,
  dateType = "start", // "start" for 8am, "termination" for 5pm
}) {
  const [value, setValue] = React.useState(
    externalValue ? dayjs(externalValue) : null
  );

  // Update internal value when external value changes
  React.useEffect(() => {
    if (externalValue) {
      setValue(dayjs(externalValue));
    } else {
      setValue(null);
    }
  }, [externalValue]);

  const handleChange = React.useCallback(
    (newValue) => {
      if (!newValue) {
        setValue(null);
        setDate(null);
        return;
      }

      setValue(newValue);

      // Set the time based on dateType
      // Start date: 8am, Termination date: 5pm
      const hour = dateType === "start" ? 8 : 17; // 8am or 5pm
      const minute = 0;

      // Create a new date with the selected date and specified time in system timezone
      const dateWithTime = newValue
        .hour(hour)
        .minute(minute)
        .second(0)
        .millisecond(0);

      // Convert to JavaScript Date object (in system timezone)
      var newDate = dateWithTime.toDate();
      setDate(newDate);
    },
    [setDate, dateType]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Stack spacing={2}>
        <DatePicker
          label={label}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          renderInput={(params) => (
            <TextField {...params} disabled={disabled} />
          )}
        />
      </Stack>
    </LocalizationProvider>
  );
});
