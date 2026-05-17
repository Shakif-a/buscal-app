import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

{/* <DialogAlert setter={deleteFood} buttonColor={'error'} mWidth={'100px'} buttonTitle={"Delete"} 
buttonIcon={<DeleteIcon />}
dialogTitle={""} 
dialogDescription={""}
dialogCancelTitle={"Disagree"} 
dialogAcceptTitle={"Agree"}/> */}

export default function DialogAlert({ setter, buttonColor, mWidth, buttonTitle, buttonIcon, dialogTitle, dialogDescription, dialogCancelTitle, dialogAcceptTitle }) {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAccept = () => {
    setter()
    setOpen(false);
  };


  return (
    <div>

      <Button variant="contained" startIcon={buttonIcon} color={buttonColor} sx={{ maxWidth: mWidth }}
        onClick={handleClickOpen}>
        {buttonTitle}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {dialogTitle}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {dialogDescription}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{dialogCancelTitle}</Button>
          <Button onClick={handleAccept} autoFocus>
            {dialogAcceptTitle}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
