import * as React from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';

    // <DropdownAutocomplete 
    //   label={"Select CAR"} 
    //   listArrayObject={myCars} 
    //   onChangeFunction={selectedCarChange}
    //   searchKey={['title','title2']} 
    //   backgroundColor={'white'}
    //   minW={300} 
    //   maxW={600}
    // />


export default function DropdownAutocompleteMultipleLabel({label, val, listArrayObject, onChangeFunction, searchKey, backgroundColor, minW, maxW}) {

    const filterOptions = createFilterOptions({
        matchFrom: 'start',
        stringify: (option) => option[searchKey[0]],
      });

    function optionLabel(option){

      let res = "";

      for(let i=0; i<searchKey.length; i++){
        if (i + 1 === searchKey.length) {
          res += option[searchKey[i]]
        } else {
          res += option[searchKey[i]] + " "
        }
      }

      return(res)
    }

  return (
    
      <Autocomplete
        id="filter-demo"
        options={listArrayObject}
        getOptionLabel={(option) => ( optionLabel(option) )}
        onChange={(event, value) => onChangeFunction(value)}
        filterOptions={filterOptions}
        sx={{ minWidth: minW, maxWidth: maxW, backgroundColor: backgroundColor, }}
        //value={val}
        renderInput={(params) => <TextField {...params} label={label} />}
        //renderOption={(option) => <span>{option[searchKey]}</span>}
      />  

  );
}