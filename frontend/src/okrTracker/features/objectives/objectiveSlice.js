import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import objectiveService from "./objectiveService";

const initialState = {
  objectives: [],
  currentObjective: null,
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
};

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS--------------------------------------
//-----------------------------------------------------------------------------------

export const getObjectives = createAsyncThunk(
  "objectives/getAll",
  async (_, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await objectiveService.getObjectives(token);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

export const getObjectiveById = createAsyncThunk(
  "objectives/getById",
  async (objectiveId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await objectiveService.getObjectiveById(objectiveId, token);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-----------------------------------------------------------------------------------
//--------------------------------------CREATORS-------------------------------------
//-----------------------------------------------------------------------------------

export const createObjective = createAsyncThunk(
  "objectives/create",
  async (objectiveData, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await objectiveService.createObjective(objectiveData, token);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-----------------------------------------------------------------------------------
//--------------------------------------DELETERS-------------------------------------
//-----------------------------------------------------------------------------------

export const deleteObjective = createAsyncThunk(
  "objectives/delete",
  async (objectiveId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await objectiveService.deleteObjective(objectiveId, token);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATERS-------------------------------------
//-----------------------------------------------------------------------------------

export const updateObjective = createAsyncThunk(
  "objectives/update",
  async ({ objectiveId, objectiveData }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await objectiveService.updateObjective(objectiveId, objectiveData, token);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-------------------------------------CREATE SLICE------------------------------------

export const objectiveSlice = createSlice({
  name: "objectives",
  initialState,
  reducers: {
    reset: (state) => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Fetch All Objectives
      .addCase(getObjectives.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getObjectives.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.objectives = action.payload;
      })
      .addCase(getObjectives.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Fetch Single Objective By ID
      .addCase(getObjectiveById.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.isSuccess = false;
        state.message = "";
      })
      .addCase(getObjectiveById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.currentObjective = action.payload;
      })
      .addCase(getObjectiveById.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Create Objective
      .addCase(createObjective.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.isSuccess = false;
        state.message = "";
      })
      .addCase(createObjective.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.objectives.push(action.payload);
        state.message = "Objective created successfully.";
      })
      .addCase(createObjective.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Delete Objective
      .addCase(deleteObjective.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.isSuccess = false;
        state.message = "";
      })
      .addCase(deleteObjective.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.objectives = state.objectives.filter(
          (obj) => obj._id !== action.payload.id && obj.id !== action.payload.id
        );
        state.message = "Objective deleted successfully.";
      })
      .addCase(deleteObjective.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Update Objective
      .addCase(updateObjective.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.isSuccess = false;
        state.message = "";
      })
      .addCase(updateObjective.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.objectives = state.objectives.map((obj) =>
          obj._id === action.payload._id || obj.id === action.payload.id
            ? action.payload
            : obj
        );
        state.message = "Objective updated successfully.";
      })
      .addCase(updateObjective.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const { reset } = objectiveSlice.actions;
export default objectiveSlice.reducer;
