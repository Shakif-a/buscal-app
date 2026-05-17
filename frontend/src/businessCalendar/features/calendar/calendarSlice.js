import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import calendarService from "./calendarService";

const initialState = {
  userEntries: [],
  supervisorEntries: [],
  allEntries: [],
  calendarHistory: [],
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: "",
};

//-----------------------------------------------------------------------------------
//--------------------------------------GETTERS----------------------------------
//-----------------------------------------------------------------------------------

export const getAllEntry = createAsyncThunk(
  "calendar/getAll",
  async (_, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.getAllEntry(token);
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

export const getUserEntries = createAsyncThunk(
  "calendar/getUserEntries",
  async (_, { getState, rejectWithValue }) => {
    try {
      const id = getState().auth.user._id;
      const token = getState().auth.user.token;

      const userEntries = await calendarService.getUserEntries(id, token);
      return userEntries;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getEntryById = createAsyncThunk(
  "calendar/getEntryById",
  async (entryId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.getEntryById(entryId, token);
    } catch (error) {
      throw error;
    }
  }
);

export const getSupervisorEntries = createAsyncThunk(
  "calendar/getSupervisorEntries",
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.user.token;
      const supervisorId = getState().auth.user._id;
      const supervisorEntries = await calendarService.getSupervisorEntries(
        supervisorId,
        token
      );
      return supervisorEntries;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const getAllHistory = createAsyncThunk(
  "calendar/getAllHistory",
  async (_, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.getAllHistory(token);
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

export const getHistoryById = createAsyncThunk(
  "calendar/getHistoryById",
  async (historyId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.getHistoryById(historyId, token);
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
//--------------------------------------CREATORS----------------------------------
//-----------------------------------------------------------------------------------

export const createEntry = createAsyncThunk(
  "calendar/create",
  async (entry, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.createEntry(entry, token);
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
//--------------------------------------DELETERS----------------------------------
//-----------------------------------------------------------------------------------

export const deleteEntry = createAsyncThunk(
  "calendar/deleteEntry",
  async ({ entryId, notes }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.deleteEntry(entryId, token, notes);
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

export const deleteRecurringEntries = createAsyncThunk(
  "calendar/deleteRecurringEntries",
  async (entryId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.deleteRecurringEntries(entryId, token);
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
//--------------------------------------UPDATERS----------------------------------
//-----------------------------------------------------------------------------------

export const updateEntry = createAsyncThunk(
  "calendar/updateEntry",
  async ({ entryId, entryData }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.updateEntry(entryId, entryData, token);
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

export const updateRecurringEntries = createAsyncThunk(
  "calendar/updateRecurringEntries",
  async ({ entryId, entryData }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.updateRecurringEntries(
        entryId,
        entryData,
        token
      );
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

export const reassignEntry = createAsyncThunk(
  "calendar/reassignEntry",
  async ({ entryId, reassignmentData }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.user.token;
      return await calendarService.reassignEntry(
        entryId,
        reassignmentData,
        token
      );
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

export const calendarSlice = createSlice({
  name: "calendar",
  initialState,
  reducers: {
    reset: (state) => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(createEntry.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(createEntry.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.userEntries.push(action.payload);
        state.message = "Calendar entry created successfully.";
      })
      .addCase(createEntry.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getUserEntries.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getUserEntries.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.userEntries = action.payload;
      })
      .addCase(getUserEntries.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getSupervisorEntries.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getSupervisorEntries.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.supervisorEntries = action.payload;
      })
      .addCase(getSupervisorEntries.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getAllEntry.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getAllEntry.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.allEntries = action.payload;
      })
      .addCase(getAllEntry.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(deleteEntry.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteEntry.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.message = "Calendar entry deleted successfully.";
        state.userEntries = state.userEntries.filter(
          (entry) => entry._id !== action.meta.arg.entryId
        );
      })
      .addCase(deleteEntry.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(deleteRecurringEntries.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(deleteRecurringEntries.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.message = "Recurring calendar entries deleted successfully.";
        state.userEntries = state.userEntries.filter(
          (entry) => entry._id !== action.meta.arg.entryId
        );
      })
      .addCase(deleteRecurringEntries.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(updateEntry.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateEntry.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.message = "Calendar entry updated successfully.";
        state.userEntries = state.userEntries.map((entry) =>
          entry._id === action.payload._id ? action.payload : entry
        );
      })
      .addCase(updateEntry.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(updateRecurringEntries.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(updateRecurringEntries.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.message = "Recurring calendar entries updated successfully.";
        state.userEntries = state.userEntries.map((entry) =>
          entry._id === action.payload._id ? action.payload : entry
        );
      })
      .addCase(updateRecurringEntries.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getAllHistory.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getAllHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.calendarHistory = action.payload;
      })
      .addCase(getAllHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(getHistoryById.pending, (state) => {
        state.isLoading = false;
      })
      .addCase(getHistoryById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.calendarHistory = action.payload;
      })
      .addCase(getHistoryById.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      })
      .addCase(reassignEntry.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(reassignEntry.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.message = "Calendar entry reassigned successfully.";
        state.userEntries = state.userEntries.map((entry) =>
          entry._id === action.payload._id ? action.payload : entry
        );
      })
      .addCase(reassignEntry.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
      });
  },
});

export const { reset } = calendarSlice.actions;
export default calendarSlice.reducer;
