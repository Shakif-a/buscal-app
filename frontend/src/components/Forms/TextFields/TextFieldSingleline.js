import React from 'react'
import TextField from '@mui/material/TextField';

//any input
{/* <TextFieldSingleline label={"Meeting Time"} setter={setMeetingTime} minWidth={'300px'} maxWidth={'300px'} helpertext={""} defaultVal={""} autoC={'off'}/> */}

//number only
{/* <TextFieldSingleline label={"Meeting Time"} setter={setMeetingTime} autoC={'off'}
    minWidth={'300px'} maxWidth={'300px'} helpertext={""} inputProps={{ type: 'number'}} defaultVal={""}/> */}

    //-------------EXAMPLE-----------
    
  //   <TextField
  //   label={"Telephone Number"}
  //   autoComplete={'off'}
  //   style={{ textAlign: 'left', minWidth: '250px' }}
  //   onChange={(event) => {
  //     setTelephoneNumber(event.target.value);
  //     console.log(event.target.value)
  //   }}
  //   inputProps={{ type: 'number' }}
  // /> 
    

const TextFieldSingleline = ({label, val, setter, minWidth, maxWidth, helpertext, inputProps, defaultVal, autoC, id}) => {

  if(id === ""){id = "outlined-multiline-static"}

  return (

    <TextField
    id={id}
    style={{ minWidth: minWidth, maxWidth: maxWidth }}
    label={label}
    helperText={helpertext}
    required fullWidth 
    autoComplete={autoC}
    //sx={{ backgroundColor: 'white', }}
    //multiline
    //rows={rows}
    //value={val}
    //defaultValue={defaultVal}
    inputProps={inputProps}
    onChange={(event) => {
        setter(event.target.value);
    }}
    />

  )
}

export default TextFieldSingleline 