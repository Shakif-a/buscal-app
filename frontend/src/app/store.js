import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import calendarReducer from "../businessCalendar/features/calendar/calendarSlice";

// Add your own slices here as you build new modules (e.g. OKR)
import okrReducer from "../okrTracker/features/objectives/objectiveSlice";
import keyResultReducer from "../okrTracker/features/keyResults/keyResultSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    calendar: calendarReducer,
    okr: okrReducer,
    keyResults: keyResultReducer,
  },
});
