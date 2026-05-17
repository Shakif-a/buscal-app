import * as React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';

{/* <DropdownAutocomplete 
  label={"Select CAR"} 
  listArrayObject={myCars} 
  onChangeFunction={selectedCarChange}
  searchKey={'title'} 
//   searchKey2={''}
  backgroundColor={'white'}
  minW={300}
  maxW={600}
/> */}


export default function DropdownAutocomplete({label, val, listArrayObject, onChangeFunction, searchKey, searchKey2, backgroundColor, minW, maxW, prefix}) {

    const filterOptions = createFilterOptions({
        matchFrom: 'start',
        stringify: (option) => option[searchKey].toString(),
      });
      

  return (
    
      <Autocomplete
        id="filter-demo"
        options={listArrayObject}
        getOptionLabel={(option) => (searchKey2 != null ? 
          (prefix ?
            (prefix + option[searchKey] + ' → ' + option[searchKey2]) 
            :
            (option[searchKey] + ' → ' + option[searchKey2]) 
          )
          : 
          option[searchKey]
          )}
        onChange={(event, value) => onChangeFunction(value)}
        filterOptions={filterOptions}
        sx={{ minWidth: minW, maxWidth: maxW, backgroundColor: backgroundColor, }}
        //value={val}
        renderInput={(params) => <TextField {...params} label={label} />}
        //renderOption={(option) => <span>{option[searchKey]}</span>}
      />  

  );
}