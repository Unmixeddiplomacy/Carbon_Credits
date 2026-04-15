import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiClient from "../api/client";

// ============================================================
// Async Thunks
// ============================================================

/**
 * Fetch accrual status (trees with accrual info)
 */
export const fetchAccrualStatus = createAsyncThunk(
  "verification/fetchAccrualStatus",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/credits/accrual-status");
      return res.data;
    } catch (err) {
      console.error("fetchAccrualStatus error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load accrual status"
      );
    }
  }
);

/**
 * Fetch user's verifications
 */
export const fetchMyVerifications = createAsyncThunk(
  "verification/fetchMyVerifications",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/verifications/my");
      return res.data?.verifications || [];
    } catch (err) {
      console.error("fetchMyVerifications error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load verifications"
      );
    }
  }
);

/**
 * Fetch dead trees
 */
export const fetchDeadTrees = createAsyncThunk(
  "verification/fetchDeadTrees",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/verifications/dead-trees");
      return res.data?.deadTrees || [];
    } catch (err) {
      console.error("fetchDeadTrees error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load dead trees"
      );
    }
  }
);

/**
 * Submit a verification
 */
export const submitVerification = createAsyncThunk(
  "verification/submitVerification",
  async (data, thunkAPI) => {
    try {
      const res = await apiClient.post("/verifications", data);
      return res.data;
    } catch (err) {
      console.error("submitVerification error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Failed to submit verification"
      );
    }
  }
);

/**
 * Report tree death
 */
export const reportTreeDeath = createAsyncThunk(
  "verification/reportTreeDeath",
  async (data, thunkAPI) => {
    try {
      const res = await apiClient.post("/verifications/report-death", data);
      return res.data;
    } catch (err) {
      console.error("reportTreeDeath error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Failed to report tree death"
      );
    }
  }
);

/**
 * Fetch all verification data at once
 */
export const fetchAllVerificationData = createAsyncThunk(
  "verification/fetchAll",
  async (_, thunkAPI) => {
    try {
      const [accrualRes, verificationsRes, deadTreesRes] = await Promise.all([
        apiClient.get("/credits/accrual-status"),
        apiClient.get("/verifications/my"),
        apiClient.get("/verifications/dead-trees"),
      ]);

      return {
        trees: accrualRes.data?.trees || [],
        lastAccrualRun: accrualRes.data?.lastAccrualRun || null,
        pendingIssuances: accrualRes.data?.pendingIssuances || { count: 0, totalAmount: 0 },
        verifications: verificationsRes.data?.verifications || [],
        deadTrees: deadTreesRes.data?.deadTrees || [],
      };
    } catch (err) {
      console.error("fetchAllVerificationData error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load verification data"
      );
    }
  }
);

// ============================================================
// Slice
// ============================================================

const initialState = {
  // Trees with accrual info
  trees: [],
  lastAccrualRun: null,
  pendingIssuances: { count: 0, totalAmount: 0 },
  
  // Verifications
  verifications: [],
  
  // Dead trees
  deadTrees: [],
  
  // Loading states
  isLoading: false,
  isSubmitting: false,
  
  // Error
  error: null,
  
  // Track if data has been loaded
  hasLoaded: false,
};

const verificationSlice = createSlice({
  name: "verification",
  initialState,
  reducers: {
    clearVerificationData(state) {
      state.trees = [];
      state.verifications = [];
      state.deadTrees = [];
      state.lastAccrualRun = null;
      state.pendingIssuances = { count: 0, totalAmount: 0 };
      state.error = null;
      state.hasLoaded = false;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch all verification data
    builder
      .addCase(fetchAllVerificationData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllVerificationData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.trees = action.payload.trees;
        state.lastAccrualRun = action.payload.lastAccrualRun;
        state.pendingIssuances = action.payload.pendingIssuances;
        state.verifications = action.payload.verifications;
        state.deadTrees = action.payload.deadTrees;
        state.hasLoaded = true;
      })
      .addCase(fetchAllVerificationData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Fetch accrual status
    builder
      .addCase(fetchAccrualStatus.fulfilled, (state, action) => {
        state.trees = action.payload?.trees || [];
        state.lastAccrualRun = action.payload?.lastAccrualRun || null;
        state.pendingIssuances = action.payload?.pendingIssuances || { count: 0, totalAmount: 0 };
      });

    // Fetch verifications
    builder
      .addCase(fetchMyVerifications.fulfilled, (state, action) => {
        state.verifications = action.payload;
      });

    // Fetch dead trees
    builder
      .addCase(fetchDeadTrees.fulfilled, (state, action) => {
        state.deadTrees = action.payload;
      });

    // Submit verification
    builder
      .addCase(submitVerification.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(submitVerification.fulfilled, (state, action) => {
        state.isSubmitting = false;
        // Add to verifications list
        if (action.payload?.verification) {
          state.verifications.unshift({
            id: action.payload.verification.id,
            status: action.payload.verification.status,
            createdAt: action.payload.verification.createdAt,
            distanceFromTree: action.payload.verification.distanceFromTree,
          });
        }
      })
      .addCase(submitVerification.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });

    // Report tree death
    builder
      .addCase(reportTreeDeath.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(reportTreeDeath.fulfilled, (state) => {
        state.isSubmitting = false;
      })
      .addCase(reportTreeDeath.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error = action.payload;
      });
  },
});

export const { clearVerificationData, clearError } = verificationSlice.actions;

// Selectors
export const selectVerificationState = (state) => state.verification;
export const selectVerificationTrees = (state) => state.verification.trees;
export const selectVerifications = (state) => state.verification.verifications;
export const selectDeadTrees = (state) => state.verification.deadTrees;
export const selectVerificationLoading = (state) => state.verification.isLoading;
export const selectVerificationSubmitting = (state) => state.verification.isSubmitting;
export const selectVerificationError = (state) => state.verification.error;
export const selectVerificationHasLoaded = (state) => state.verification.hasLoaded;
export const selectLastAccrualRun = (state) => state.verification.lastAccrualRun;

export default verificationSlice.reducer;
