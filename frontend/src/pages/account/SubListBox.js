import React, { useState } from "react";
import { useSelector } from "react-redux";
import {
  Box,
  Button,
  TextField,
  Checkbox,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  FormHelperText,
  IconButton,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import settingsService from "../../features/settings/settingsService";

const SubListBox = ({ label, items, setItems, categories }) => {
  const [newItem, setNewItem] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [error, setError] = useState("");
  const { user } = useSelector((state) => state.auth);
  const [sortMode, setSortMode] = useState("original"); // New state for sorting mode

  const originalItems = [...items]; // Preserve original order

  // Function to sort items based on the current sort mode
  const sortItems = () => {
    if (sortMode === "az") {
      return [...items].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "za") {
      return [...items].sort((a, b) => b.name.localeCompare(a.name));
    }
    return originalItems;
  };

  const handleSortToggle = () => {
    setSortMode((prevMode) =>
      prevMode === "original" ? "az" : prevMode === "az" ? "za" : "original"
    );
  };

  const handleAddItem = async () => {
    if (newItem.trim() === "" || !selectedCategory) {
      setError("Please select a category and enter a valid item.");
      return;
    }

    const category = categories.find((cat) => cat.name === selectedCategory);
    if (!category) {
      setError("Selected category is not valid.");
      return;
    }

    // Check if the item already exists within the selected category
    const itemExists = items.some(
      (item) => item.name === newItem && item.category === selectedCategory
    );

    if (itemExists) {
      setError("Item already exists in the selected category.");
      return;
    }

    try {
      const subcategoryData = {
        name: newItem,
        parentCategory: category._id,
      };

      await settingsService.createSubcategory(subcategoryData, user.token);
      setItems([...items, { name: newItem, category: category.name }]);
      setNewItem("");
      setSelectedCategory("");
      setError("");
    } catch (error) {
      console.error("Error creating subcategory:", error);
      setError("Failed to create subcategory. Please try again.");
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const remainingItems = items.filter(
        (item) => !selectedItems.includes(item)
      );
      setItems(remainingItems);
      for (const item of selectedItems) {
        await settingsService.deleteSubcategory(item.name, user.token);
      }
      setSelectedItems([]);
    } catch (error) {
      console.error("Error deleting subcategory:", error);
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItems(
      selectedItems.includes(item)
        ? selectedItems.filter((i) => i !== item)
        : [...selectedItems, item]
    );
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
            <Typography>{`${item.name} - ${item.category}`}</Typography>
          </Box>
        ))}
      </Box>
      <FormControl fullWidth margin="normal" error={!!error}>
        <InputLabel>Select Category</InputLabel>
        <Select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map((category) => (
            <MenuItem key={category._id} value={category.name}>
              {category.name}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
      <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
        <TextField
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          label="New Item"
          variant="outlined"
          fullWidth
          error={!!error}
          helperText={error && "Please enter a valid item."}
        />
        <Button variant="contained" onClick={handleAddItem}>
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
    </Paper>
  );
};

export default SubListBox;
