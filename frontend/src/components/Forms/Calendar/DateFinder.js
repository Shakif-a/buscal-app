import React from 'react'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import TextField from '@mui/material/TextField';
import * as moment from 'moment'

const DateFinder = ({getter, setter, setter2, id}) => {
    return (
        <>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker                 
                    openTo="year"
                    views={['year', 'month', 'day']}
                    label="Please select a date"
                    inputFormat="dd/MM/yyyy"
                    value={getter}
                    onChange={(newValue) => {
                        setter(newValue);
                        //setter(moment(newValue).format('DD/MM/YYYY'));
                        //console.log(moment(newValue).format('DD/MM/YYYY'))
                    }}
                    renderInput={(params) => <TextField {...params} helperText={null} id={id}/>}
                />
            </LocalizationProvider>
        </>
    )
}

export default DateFinder