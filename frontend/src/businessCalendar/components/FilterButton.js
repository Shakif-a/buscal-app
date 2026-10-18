import React, { useState } from "react";
import { Modal } from "antd";
import { FilterAltSharp as FilterAltSharpIcon } from "@mui/icons-material";
import { IconButton, Box } from "@mui/material";
import FilterModal from "./FilterModal";

const FilterButton = ({
  size = "22px",
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
    <>
      <IconButton
        title={"Filter"}
        aria-label="Filter calendar entries"
        onClick={handleClick}
        sx={{
          width: 44,
          height: 44,
          border: "1px solid #d9dfea",
          borderRadius: "10px",
          backgroundColor: "#ffffff",
          color: "1f1e40",
          flexShrink: 0,
          "&:hover": {
            backgroundColor: "#cfe2ff",
            borderColor: "#72cdf4",
          },
        }}
      >
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
    </>
  );
};

export default FilterButton;
