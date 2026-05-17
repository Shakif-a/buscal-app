import React from 'react'
import TextField from '@mui/material/TextField';

//<TextFieldMultiline label={"Meeting Time"} setter={setMeetingTime} minWidth={'300px'} maxWidth={'300px'} rows={3} helpertext={""}/>

    // <TextField
    //   label={"Telephone Number"}
    //   autoComplete={'off'}
    //   style={{ textAlign: 'left', minWidth: '250px' }}
    //   onChange={(event) => {
    //     setTelephoneNumber(event.target.value);
    //     console.log(event.target.value)
    //   }}
    //   rows={3}
    //   multiline
    //   inputProps={{ type: 'number' }}
    // /> 

const TextFieldMultiline = ({label, setter, minWidth, maxWidth, rows, helpertext}) => {
  return (

    <TextField
    id="outlined-multiline-static"
    style={{ minWidth: minWidth, maxWidth: maxWidth }}
    label={label}
    helperText={helpertext}
    multiline
    rows={rows}
    onChange={(event) => {
        setter(event.target.value);
    }}
    />

  )
}

export default TextFieldMultiline