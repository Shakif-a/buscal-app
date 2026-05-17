import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";

const DropdownSelect = ({
  title,
  getter,
  setter,
  mitems,
  minWidth,
  maxWidth,
  backgroundColor,
  id,
}) => {
  if (id === "") {
    id = "demo-simple-select";
  }

  return (
    <div>
      <FormControl>
        <InputLabel id="demo-simple-select-label" className="mt-1" shrink>
          {title}
        </InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id={id}
          label={title}
          style={{
            textAlign: "left",
            minWidth: minWidth,
            maxWidth: maxWidth,
            backgroundColor: backgroundColor,
          }}
          value={getter}
          onChange={(event) => {
            setter(event.target.value);
            //console.log(event.target.value)
          }}
        >
          {mitems.map((item, length) => {
            return (
              <MenuItem id={`dropdown${length}`} value={item} key={length}>
                {item}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </div>
  );
};

export default DropdownSelect;
