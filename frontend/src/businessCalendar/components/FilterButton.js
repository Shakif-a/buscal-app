import React, { useState } from "react";
import { Modal } from "antd";
import { FilterAltSharp as FilterAltSharpIcon } from "@mui/icons-material";
import { IconButton, Box } from "@mui/material";
import FilterModal from "./FilterModal";

const FilterButton = ({
  size = "50px",
  setFilterOptions,
  emailList,
  filterOptions,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const handleModalOpen = () => setModalOpen(true);
  const handleModalClose = () => setModalOpen(false);
  const handleModalReset = () => {
    setModalOpen(false);
    setFilterOptions({
      startDate: null,
      endDate: null,
      categories: [],
      users: [],
      priority: "all",
      completionStatus: "all",
    });
  };

  const iconStyles = {
    fontSize: size,
  };

  const handleClick = () => {
    handleModalOpen();
  };

  return (
    <Box
      sx={{
        border: "1px solid black",
        borderRadius: "4px",
        display: "inline-flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "2px",
        boxShadow: "0px 3px 5px 2px rgba(0,0,0,0.3)",
      }}
    >
      <IconButton title={"Filter"} onClick={handleClick}>
        <FilterAltSharpIcon style={iconStyles} />
      </IconButton>
      <Modal
        title="Filter"
        open={modalOpen}
        onOk={handleModalClose}
        onCancel={handleModalReset}
        okButtonProps={{ style: { backgroundColor: "blue" } }}
      >
        <FilterModal
          setFilterOptions={setFilterOptions}
          emailList={emailList}
          filterOptions={filterOptions}
        />
      </Modal>
    </Box>
  );
};

export default FilterButton;
