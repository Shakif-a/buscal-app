import React from 'react';
import Button from '@mui/material/Button';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { toast } from 'react-toastify'

//     //------------

//     function testSetter() {

//         try {
//             dispatch(createTest(id))
//             setTest('')
//         } catch (error) {

//         }

//     }

// //-------------call this function within render

// function createButton() {

//     if(error logic){

//         return(
//             <SnackbarSuccess 
//                 icon={<SendIcon />} status={'error'} buttonTitle={'Submit'}
//                 minW={'100px'} maxW={'100px'}
//                 errorMessage={'This is an error message!'}
//             />
//         )
        
//     }else{
//         return(
//             <SnackbarSuccess setter={testSetter}
//                 icon={<SendIcon />} status={'success'} buttonTitle={'Submit'}
//                 minW={'100px'} maxW={'100px'}
//                 successMessage={'This is a success message!'} 
//             />
//         )
//     }

// }


function MyApp({icon, setter, status, buttonTitle, minW, maxW, successMessage, errorMessage}) {
  const { enqueueSnackbar } = useSnackbar();


  const handleClick = () => {
    enqueueSnackbar('Custom');
  };

  const callSuccess = (variant) => () => {

    enqueueSnackbar(successMessage, { variant });
  }

  const handleClickVariant = (variant) => () => {

    // variant could be success, error, warning, info, or default

    if(status == 'success'){
        {setter && (setter())}

        enqueueSnackbar(successMessage, { variant });

    }
    else if(status == 'error'){
        enqueueSnackbar(errorMessage, { variant });
    }
    
  };

    return (
        <React.Fragment>

            <Button variant="contained" endIcon={icon} color="primary"
                onClick={handleClickVariant(status)}
                sx={{
                    m: 0, boxShadow: 3, minWidth: minW, maxWidth: maxW,
                }}>
                {buttonTitle}
            </Button>

        </React.Fragment>
    );
}

export default function SnackbarSuccess({icon, setter, status, buttonTitle, minW, maxW, successMessage, errorMessage}) {
  return (
    <SnackbarProvider maxSnack={3}>
      <MyApp icon={icon} setter={setter} status={status} buttonTitle={buttonTitle} minW={minW} maxW={maxW} 
            successMessage={successMessage} errorMessage={errorMessage} />
    </SnackbarProvider>
  );
}
