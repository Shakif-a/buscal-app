import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import keyResultService from "./keyResultService";

const initialState = {
  keyResults: [],
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
};

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS--------------------------------------
//-----------------------------------------------------------------------------------

export const getKeyResultsByObjective = createAsyncThunk(
  "keyResults/getByObjective",
  async (objectiveId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await keyResultService.getKeyResultsByObjective(objectiveId, token);
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-----------------------------------------------------------------------------------
//--------------------------------------CREATORS-------------------------------------
//-----------------------------------------------------------------------------------

export const createKeyResult = createAsyncThunk(
  "keyResults/create",
  async ({ objectiveId, keyResultData }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await keyResultService.createKeyResult(
        objectiveId,
        keyResultData,
        token
      );
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-----------------------------------------------------------------------------------
//--------------------------------------DELETERS-------------------------------------
//-----------------------------------------------------------------------------------

export const deleteKeyResult = createAsyncThunk(
  "keyResults/delete",
  async ({ objectiveId, keyResultId }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await keyResultService.deleteKeyResult(
        objectiveId,
        keyResultId,
        token
      );
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-----------------------------------------------------------------------------------
//--------------------------------------UPDATERS-------------------------------------
//-----------------------------------------------------------------------------------

export const updateKeyResult = createAsyncThunk(
  "keyResults/update",
  async ({ objectiveId, keyResultId, keyResultData }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await keyResultService.updateKeyResult(
        objectiveId,
        keyResultId,
        keyResultData,
        token
      );
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

//-------------------------------------CREATE SLICE------------------------------------

export const keyResultSlice = createSlice({
  name: "keyResults",
  initialState,
  reducers: {
    reset: (state) => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Get Key Results
      .addCase(getKeyResultsByObjective.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getKeyResultsByObjective.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.keyResults = action.payload;
      })
      .addCase(getKeyResultsByObjective.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Create Key Result
      .addCase(createKeyResult.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createKeyResult.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.keyResults.push(action.payload);
      })
      .addCase(createKeyResult.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Update Key Result
      .addCase(updateKeyResult.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateKeyResult.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.keyResults = state.keyResults.map((kr) =>
          kr._id === action.payload._id ? action.payload : kr
        );
      })
      .addCase(updateKeyResult.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })

      // Delete Key Result
      .addCase(deleteKeyResult.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteKeyResult.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.keyResults = state.keyResults.filter(
          (kr) => kr._id !== action.payload.id
        );
      })
      .addCase(deleteKeyResult.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const { reset } = keyResultSlice.actions;
export default keyResultSlice.reducer;