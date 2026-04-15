import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiClient from "../api/client";

export const fetchTrees = createAsyncThunk("trees/fetchAll", async (_, thunkAPI) => {
  try {
    const res = await apiClient.get("/trees");
    return res.data?.trees || [];
  } catch (err) {
    console.error("fetchTrees error", err);
    return thunkAPI.rejectWithValue(
      err?.response?.data?.error || "Unable to load trees right now."
    );
  }
});

const treesSlice = createSlice({
  name: "trees",
  initialState: {
    items: [],
    isLoading: false,
    error: "",
    hasLoaded: false,
  },
  reducers: {
    clearTrees(state) {
      state.items = [];
      state.error = "";
      state.hasLoaded = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrees.pending, (state) => {
        state.isLoading = true;
        state.error = "";
      })
      .addCase(fetchTrees.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
        state.hasLoaded = true;
      })
      .addCase(fetchTrees.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Unable to load trees right now.";
      });
  },
});

export const { clearTrees } = treesSlice.actions;

export const selectTreesState = (state) => state.trees;

export default treesSlice.reducer;
