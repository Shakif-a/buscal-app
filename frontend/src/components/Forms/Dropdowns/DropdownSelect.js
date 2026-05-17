import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import Box from "@mui/material/Box";

const DropdownSelect = ({
  title,
  getter,
  setter,
  mitems,
  minWidth,
  maxWidth,
  backgroundColor,
  id = "demo-simple-select",
}) => {
  return (
    <Box>
      <FormControl>
        <InputLabel id="demo-simple-select-label" shrink sx={{ mt: 1 }}>
          {title}
        </InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id={id}
          label={title}
          sx={{
            textAlign: "left",
            minWidth,
            maxWidth,
            backgroundColor,
          }}
          value={getter}
          onChange={(event) => {
            setter(event.target.value);
          }}
        >
          {mitems.map((item, length) => (
            <MenuItem id={`dropdown${length}`} value={item} key={length}>
              {item}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default DropdownSelect;
