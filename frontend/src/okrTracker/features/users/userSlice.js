import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import userService from "./userService";

// Fetch all users
export const getAllUsers = createAsyncThunk(
  "users/getAll",
  async (token, thunkAPI) => {
    try {
      const data = await userService.getUsers(token);
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || "Failed to fetch users"
      );
    }
  }
);

const initialState = {
  users: [],
  isLoading: false,
  isError: false,
  message: "",
};

const userSlice = createSlice({
  name: "users",
  initialState,
  extraReducers: (builder) => {
    builder
      .addCase(getAllUsers.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export default userSlice.reducer;