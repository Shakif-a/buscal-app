import React, { useState } from "react";
import Box from "@mui/material/Box";
import { useSelector } from "react-redux";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import FormHelperText from "@mui/material/FormHelperText";
import FormControl from "@mui/material/FormControl";
import Paper from "@mui/material/Paper";
import IconButton from "@mui/material/IconButton";
import settingsService from "../../features/settings/settingsService";

const ListBox = ({ label, items, setItems, onAddItem, onDeleteItem }) => {
  const [newItem, setNewItem] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [error, setError] = useState("");
  const { user } = useSelector((state) => state.auth);
  const [sortMode, setSortMode] = useState("original"); // New state for sorting mode

  const originalItems = [...items]; // Preserve original order

  // Function to sort items based on the current sort mode
  const sortItems = () => {
    if (sortMode === "az") {
      return [...items].sort((a, b) => a.localeCompare(b));
    } else if (sortMode === "za") {
      return [...items].sort((a, b) => b.localeCompare(a));
    }
    return originalItems;
  };

  const handleSortToggle = () => {
    setSortMode((prevMode) =>
      prevMode === "original" ? "az" : prevMode === "az" ? "za" : "original"
    );
  };

  const handleAddItem = async () => {
    if (newItem.trim() === "") {
      setError("Please enter a valid term");
      return;
    }

    if (!items.includes(newItem)) {
      try {
        const categoryData = { name: newItem };
        const createdCategory = await settingsService.createCategory(
          categoryData,
          user.token
        );
        setItems([...items, newItem]);
        onAddItem(createdCategory);
        setNewItem("");
        setError("");
      } catch (error) {
        console.error("Error creating category:", error);
      }
    } else {
      setError("Item already exists");
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const remainingItems = items.filter(
        (item) => !selectedItems.includes(item)
      );
      setItems(remainingItems);
      setSelectedItems([]);

      for (const item of selectedItems) {
        await settingsService.deleteCategory(item, user.token);
        onDeleteItem(item);
      }
    } catch (error) {
      console.error("Error deleting category: ", error);
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItems(
      selectedItems.includes(item)
        ? selectedItems.filter((i) => i !== item)
        : [...selectedItems, item]
    );
  };

  const handleAddButtonClick = () => {
    handleAddItem();
  };

  return (
    <Paper
      elevation={3}
      sx={{
        width: "33%",
        mb: 2,
        p: 2,
        border: "1px solid #ddd",
        borderRadius: "4px",
        backgroundColor: "white",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Typography variant="h6" gutterBottom>
          {label}
        </Typography>
        <IconButton title="Sort Order" onClick={handleSortToggle}>
          <ArrowDropDownIcon />
        </IconButton>
      </Box>
      <Box sx={{ mb: 1 }}>
        {sortItems().map((item, index) => (
          <Box key={index} sx={{ display: "flex", alignItems: "center" }}>
            <Checkbox
              checked={selectedItems.includes(item)}
              onChange={() => handleSelectItem(item)}
            />
            <Typography>{item}</Typography>
          </Box>
        ))}
      </Box>
      <FormControl sx={{ width: "100%" }}>
        <TextField
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          label="New Item"
          variant="outlined"
          error={Boolean(error)}
        />
        {error && <FormHelperText error>{error}</FormHelperText>}
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Button variant="contained" onClick={handleAddButtonClick}>
            Add
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteSelected}
          >
            Delete
          </Button>
        </Box>
      </FormControl>
    </Paper>
  );
};

export default ListBox;
