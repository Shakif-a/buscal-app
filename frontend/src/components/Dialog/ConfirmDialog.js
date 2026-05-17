import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

const ConfirmDialog = (props) => {
  const { title, content, open, setOpen, onConfirm, onCancel } = props;
  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="confirm-dialog"
    >
      <DialogTitle id="confirm-dialog">{title}</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            setOpen(false);
            onConfirm();
          }}
          color="primary"
        >
          Yes
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setOpen(false);
            onCancel();
          }}
          color="inherit"
        >
          No
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
