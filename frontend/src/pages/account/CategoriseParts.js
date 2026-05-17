import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import Paper from "@mui/material/Paper";
import InputBase from "@mui/material/InputBase";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { DataGrid } from "@mui/x-data-grid";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Box from "@mui/material/Box";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import {
  getPartNotes,
  getImg,
  getPdf,
  updatePartsCategory,
} from "../../features/all/allSlice";
import settingsService from "../../features/settings/settingsService";
import Spinner from "../../components/Spinner";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import ImageIcon from "@mui/icons-material/Image";
import ListBox from "./ListBox";
import SubListBox from "./SubListBox";
import Joyride from "react-joyride";
import "react-toastify/dist/ReactToastify.css";

const CategoriseParts = () => {
  const dispatch = useDispatch();
  const { partNotes, isLoading, isError, message } = useSelector(
    (state) => state.all
  );
  const { user } = useSelector((state) => state.auth); // Get user data
  const [searchText, setSearchText] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [imageContent, setImageContent] = useState("");
  const [categories, setCategories] = useState([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [dbSubcategories, setDbSubcategories] = useState([]);

  const [isTutorialRunning, setIsTutorialRunning] = useState(false);
  // Check if this is the first visit
  useEffect(() => {
    if (!localStorage.getItem("hasVisitedCategoriseParts")) {
      setIsTutorialRunning(true); // Start the tutorial
      localStorage.setItem("hasVisitedCategoriseParts", "true"); // Mark as visited
    }
  }, []);

  useEffect(() => {
    if (isError) {
      console.error(message);
    }
    try {
      dispatch(getPartNotes());
    } catch (error) {}
  }, [isError, message, dispatch]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const dbCategories = await settingsService.getAllCategories(user.token);
        const dbSubcategories = await settingsService.getAllSubcategories(
          user.token
        );

        const subcategoriesWithCategory = dbSubcategories.map((subcategory) => {
          const parentCategory = dbCategories.find(
            (category) => category._id === subcategory.parentCategory
          );
          return {
            _id: subcategory._id,
            name: subcategory.name,
            category: parentCategory ? parentCategory.name : null,
          };
        });

        const categoryNames = dbCategories.map((category) => category.name);
        setCategories(categoryNames);
        setDbCategories(dbCategories);
        setDbSubcategories(subcategoriesWithCategory);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, [user.token]);

  useEffect(() => {
    if (selectedCategory) {
      const filtered = dbSubcategories.filter(
        (subCategory) => subCategory.category === selectedCategory
      );
      setSelectedSubCategory(null);
      setFilteredSubCategories(filtered);
    } else {
      setFilteredSubCategories([]); // Show all if no category is selected
    }
  }, [dbSubcategories, selectedCategory]);

  // Extract unique brands from partNotes
  const brands = Array.from(
    new Set(partNotes.map((part) => part.brand))
  ).filter(Boolean);

  // Filter parts based on search text and selected brand
  const filteredParts = partNotes.filter((part) => {
    const searchInFields = ["partCode", "description", "longDescription"];
    const searchFieldToUse =
      searchField === "all" ? searchInFields : [searchField];

    const matchesSearch = searchFieldToUse.some((field) =>
      part[field]?.toLowerCase().includes(searchText.toLowerCase())
    );

    const matchesBrand =
      selectedBrand === "All" || part.brand === selectedBrand;

    return matchesSearch && matchesBrand;
  });

  const handleSearchChange = useCallback(
    (event) => setSearchText(event.target.value),
    []
  );
  const handleFieldChange = useCallback(
    (event) => setSearchField(event.target.value),
    []
  );
  const handleBrandChange = useCallback(
    (event, newValue) => setSelectedBrand(newValue || "All"),
    []
  );

  // Image and PDF handling
  const handleImageClick = async (itemNo) => {
    try {
      const imageObjectUrl = await dispatch(getImg(itemNo)).unwrap();

      setImageContent(
        <img src={imageObjectUrl} alt="Item" style={{ maxWidth: "100%" }} />
      );
    } catch (error) {
      setImageContent("No image");
    }
  };

  const handlePdfClick = (itemNo) => {
    dispatch(getPdf(itemNo))
      .unwrap()
      .then((pdfUrl) => {
        window.open(pdfUrl, "_blank");
      });
  };

  // Handling category/subcategory insertion
  const handleInsertion = async (type) => {
    // Validate inputs
    if (!selectedCategory || selectedCategory.trim() === "") {
      alert("Please select a category to add");
      return;
    }

    if (selectedRows.length === 0) {
      alert("Please select the parts you want to assign categories to");
      return;
    }

    if (type === "subcategory" && !selectedSubCategory) {
      alert("Please select a subcategory to add");
      return;
    }

    // Find the selectedCategory in dbCategories and extract its _id
    const selectedCategoryObj = dbCategories.find(
      (category) => category.name === selectedCategory
    );

    if (!selectedCategoryObj) {
      alert("Selected category not found");
      return;
    }

    const categoryId = selectedCategoryObj._id;

    // Extract partCodes from partNotes using selectedRows
    const partCodes = selectedRows
      .map((id) => {
        const partNote = partNotes.find((note) => note._id === id);
        return partNote ? partNote.partCode : null;
      })
      .filter((code) => code !== null);

    // If type is "subcategory", find the selectedSubCategory in dbSubcategories and extract its _id
    let subcategoryId = null;
    if (type === "subcategory") {
      const selectedSubCategoryObj = dbSubcategories.find(
        (subcategory) => subcategory.name === selectedSubCategory
      );
      if (!selectedSubCategoryObj) {
        alert("Selected subcategory not found");
        return;
      }
      subcategoryId = selectedSubCategoryObj._id;
      try {
        await settingsService.updateSubcategory(
          subcategoryId,
          { parts: partCodes },
          user.token
        );
      } catch (error) {
        console.error("Failed to update subcategory:", error);
      }
    }

    // Compute categoryData based on type
    const categoryData = {
      ids: selectedRows,
      category: selectedCategory,
      subcategory: type === "subcategory" ? selectedSubCategory : "",
    };

    // Dispatch the updatePartsCategory action
    dispatch(updatePartsCategory(categoryData))
      .unwrap()
      .then((response) => {
        console.log("Update successful:", response);
        toast.success("Updated successfully!");
        // Handle success if needed
      })
      .catch((error) => {
        console.error("Update failed:", error);
        toast.error("Update failed");
        // Handle error if needed
      });
    try {
      await settingsService.updateCategory(
        categoryId,
        { parts: partCodes },
        user.token
      );
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  };

  const handleAddCategory = (newCategory) => {
    const existingCategoryNames = dbCategories.map((category) => category.name);
    // Check if the category already exists
    if (!existingCategoryNames.includes(newCategory.name)) {
      // Update state with new category
      setDbCategories((prevCategories) => [...prevCategories, newCategory]);
    }
  };

  const handleDeleteCategory = (deletedCategory) => {
    setDbCategories((prevCategories) =>
      prevCategories.filter((category) => category.name !== deletedCategory)
    );
  };

  // Tutorial steps
  const steps = [
    {
      target: 'input[aria-label="search"]',
      content: "Use this to search for parts.",
    },
    {
      target: ".joyride-searchField",
      content:
        "You can search in all fields or specifically in code, description or long-description.",
    },
    {
      target: ".joyride-brand",
      content: "Or you can filter by a brand.",
    },
    {
      target: ".MuiDataGrid-footerContainer",
      content:
        "Use this table to sort and filter by using the options in each column header, then select the parts you want using the checkboxes. Navigate using the arrows at the bottom right.",
    },
    {
      target: ".joyride-insert-categories",
      content:
        "Use these dropdowns to select a category or subcategory that you want to add.",
    },
    {
      target: '[aria-label="insert category"]',
      content: "Use this button if you just want to add categories first.",
    },
    {
      target: '[aria-label="insert subcategory"]',
      content:
        "Or use this button to add both subcategories and categories to the selected parts.",
    },
  ];
  // DataGrid column definitions
  const columns = [
    { field: "partCode", headerName: "Part Code", width: 110 },
    { field: "description", headerName: "Description", width: 240 },
    { field: "longDescription", headerName: "Long Description", width: 310 },
    { field: "brand", headerName: "Brand", width: 150 },
    { field: "category", headerName: "Category", width: 150 },
    { field: "subCategory", headerName: "Sub-category", width: 150 },
    {
      field: "image",
      headerName: "Image",
      width: 50,
      renderCell: (params) => (
        <IconButton
          aria-label="view image"
          onClick={() => handleImageClick(params.row.partCode)}
        >
          <ImageIcon />
        </IconButton>
      ),
    },
    {
      field: "pdf",
      headerName: "Datasheet",
      width: 50,
      renderCell: (params) => (
        <IconButton
          aria-label="view pdf"
          onClick={() => handlePdfClick(params.row.partCode)}
        >
          <PictureAsPdfIcon />
        </IconButton>
      ),
    },
  ];

  // Transform filtered parts into rows for DataGrid
  const rows = filteredParts.map((part) => ({
    id: part._id, // Use _id as unique ID for each row
    partCode: part.partCode,
    description: part.description,
    longDescription: part.longDescription,
    brand: part.brand,
    category: part.category,
    subCategory: part.subCategory,
  }));

  if (isLoading) return <Spinner />;

  return (
    <div>
      <Joyride
        steps={steps}
        continuous={true}
        run={isTutorialRunning}
        scrollOffset={20}
        showProgress={true}
        showSkipButton={true}
        disableOverlay
        callback={(data) => {
          if (data.status === "finished" || data.status === "skipped") {
            setIsTutorialRunning(false);
          }
        }}
      />

      <Box display="flex" alignItems="center" mb={2}>
        <Typography variant="h5" gutterBottom>
          Categorise Parts
        </Typography>

        <IconButton
          onClick={() => setIsTutorialRunning(true)}
          aria-label="start tutorial"
          title="Replay Tutorial"
          sx={{ ml: 1 }}
        >
          <HelpOutlineIcon />
        </IconButton>
      </Box>

      <Box display="flex" alignItems="center">
        <Paper
          component="form"
          sx={{
            p: "2px 4px",
            display: "flex",
            alignItems: "center",
            width: 400,
          }}
        >
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            placeholder="Search by code/description/long description"
            inputProps={{ "aria-label": "search" }}
            value={searchText}
            onChange={handleSearchChange}
          />
        </Paper>

        <FormControl sx={{ mx: 2, minWidth: 150 }}>
          <Select
            value={searchField}
            onChange={handleFieldChange}
            inputProps={{ "aria-label": "searchField" }}
            className="joyride-searchField"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="partCode">Code</MenuItem>
            <MenuItem value="description">Description</MenuItem>
            <MenuItem value="longDescription">Long Description</MenuItem>
          </Select>
          <FormHelperText>Select search field</FormHelperText>
        </FormControl>

        <FormControl sx={{ minWidth: 250 }}>
          <Autocomplete
            options={["All", ...brands]}
            value={selectedBrand}
            onChange={handleBrandChange}
            renderInput={(params) => (
              <TextField {...params} label="Select Brand" variant="outlined" />
            )}
            className="joyride-brand"
            sx={{ minWidth: 150 }}
            renderOption={(props, option) => (
              <li {...props} key={option}>
                {option}
              </li>
            )}
            ListboxProps={{ style: { maxHeight: 200 } }}
          />
          <FormHelperText>Filter by brand</FormHelperText>
        </FormControl>
      </Box>

      {/* Insert Categories Section */}
      <Box sx={{ display: "flex", alignItems: "center", mt: 2 }}>
        <FormControl sx={{ mx: 2, minWidth: 250 }}>
          <Autocomplete
            options={categories}
            value={selectedCategory}
            onChange={(event, newValue) => setSelectedCategory(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Category"
                variant="outlined"
              />
            )}
          />
        </FormControl>
        <IconButton
          onClick={() => handleInsertion("category")}
          aria-label="insert category"
        >
          <AddCircleIcon />
        </IconButton>

        <FormControl sx={{ mx: 2, minWidth: 250 }}>
          <Autocomplete
            options={filteredSubCategories.map((sub) => sub.name)}
            value={selectedSubCategory}
            disabled={!selectedCategory}
            className="joyride-insert-categories"
            onChange={(event, newValue) => setSelectedSubCategory(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Sub-category"
                variant="outlined"
              />
            )}
          />
        </FormControl>
        <IconButton
          onClick={() => handleInsertion("subcategory")}
          aria-label="insert subcategory"
        >
          <AddCircleIcon />
        </IconButton>
      </Box>
      <Typography variant="caption">
        Select the parts you want to assign then click the + button beside the
        selected category or sub-category.
      </Typography>

      {/* DataGrid for displaying filtered parts */}
      <div style={{ height: "640px", width: "100%", marginTop: "20px" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: { page: 0, pageSize: 10 },
            },
          }}
          pageSizeOptions={[5, 10]}
          checkboxSelection
          onRowSelectionModelChange={(newSelection) => {
            setSelectedRows(newSelection);
          }}
          rowSelectionModel={selectedRows}
          disableRowSelectionOnClick
        />
      </div>

      <Box
        sx={{
          marginTop: 2,
          padding: 2,
          border: "1px solid #ddd",
          textAlign: "center",
        }}
      >
        {imageContent}
      </Box>

      {/* Render ListBox components for categories and sub-categories if the user is an admin */}
      {user.roles.includes("admin") && (
        <div>
          <Typography variant="h5" gutterBottom>
            Add or Remove Categories
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <ListBox
              label="Categories"
              items={categories}
              setItems={setCategories}
              onAddItem={handleAddCategory}
              onDeleteItem={handleDeleteCategory}
            />
            <SubListBox
              label="Sub-categories"
              items={dbSubcategories}
              setItems={setDbSubcategories}
              categories={dbCategories}
            />
          </Box>
        </div>
      )}
    </div>
  );
};

export default CategoriseParts;
