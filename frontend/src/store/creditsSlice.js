import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiClient from "../api/client";

// ============================================================
// Async Thunks
// ============================================================

/**
 * Fetch current user's credit summary
 */
export const fetchCredits = createAsyncThunk(
  "credits/fetchCredits",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/credits");
      return res.data?.credits || null;
    } catch (err) {
      console.error("fetchCredits error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load credits"
      );
    }
  }
);

/**
 * Fetch trees eligible for credit issuance
 */
export const fetchEligibleTrees = createAsyncThunk(
  "credits/fetchEligibleTrees",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/credits/eligible-trees");
      return res.data?.trees || [];
    } catch (err) {
      console.error("fetchEligibleTrees error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load eligible trees"
      );
    }
  }
);

/**
 * Issue credits for a tree
 */
export const issueCreditsForTree = createAsyncThunk(
  "credits/issueCredits",
  async ({ treeId, txHash }, thunkAPI) => {
    try {
      const res = await apiClient.post("/credits/issue", { treeId, txHash });
      return res.data;
    } catch (err) {
      console.error("issueCredits error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Failed to issue credits"
      );
    }
  }
);

/**
 * Retire credits
 */
export const retireCredits = createAsyncThunk(
  "credits/retireCredits",
  async ({ amount, reason, beneficiaryName, txHash }, thunkAPI) => {
    try {
      const res = await apiClient.post("/credits/retire", {
        amount,
        reason,
        beneficiaryName,
        txHash,
      });
      return res.data;
    } catch (err) {
      console.error("retireCredits error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Failed to retire credits"
      );
    }
  }
);

/**
 * Transfer credits to another user
 */
export const transferCredits = createAsyncThunk(
  "credits/transferCredits",
  async ({ toEmail, toWalletAddress, amount, memo, txHash }, thunkAPI) => {
    try {
      const res = await apiClient.post("/credits/transfer", {
        toEmail,
        toWalletAddress,
        amount,
        memo,
        txHash,
      });
      return res.data;
    } catch (err) {
      console.error("transferCredits error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Failed to transfer credits"
      );
    }
  }
);

/**
 * Fetch transaction history
 */
export const fetchHistory = createAsyncThunk(
  "credits/fetchHistory",
  async ({ limit = 50, offset = 0 } = {}, thunkAPI) => {
    try {
      const res = await apiClient.get(`/credits/history?limit=${limit}&offset=${offset}`);
      return res.data;
    } catch (err) {
      console.error("fetchHistory error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load history"
      );
    }
  }
);

/**
 * Fetch retirement certificates
 */
export const fetchRetirements = createAsyncThunk(
  "credits/fetchRetirements",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/credits/retirements");
      return res.data?.retirements || [];
    } catch (err) {
      console.error("fetchRetirements error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load retirements"
      );
    }
  }
);

// ============================================================
// Slice
// ============================================================

const initialState = {
  // Credit summary
  summary: null,
  summaryLoading: false,
  summaryError: "",
  summaryLoaded: false,

  // Eligible trees for issuance
  eligibleTrees: [],
  eligibleTreesLoading: false,
  eligibleTreesError: "",

  // Transaction history
  history: [],
  historyLoading: false,
  historyError: "",
  historyPagination: { limit: 50, offset: 0, hasMore: false },

  // Retirements
  retirements: [],
  retirementsLoading: false,
  retirementsError: "",

  // Operation states
  issuingCredits: false,
  issuingError: "",
  retiringCredits: false,
  retiringError: "",
  transferringCredits: false,
  transferringError: "",
};

const creditsSlice = createSlice({
  name: "credits",
  initialState,
  reducers: {
    clearCreditsState(state) {
      return initialState;
    },
    clearErrors(state) {
      state.summaryError = "";
      state.eligibleTreesError = "";
      state.historyError = "";
      state.retirementsError = "";
      state.issuingError = "";
      state.retiringError = "";
      state.transferringError = "";
    },
    // Force re-fetch credits on next access
    invalidateCredits(state) {
      state.summaryLoaded = false;
    },
    // Direct update for optimistic UI (when we know the slash amount)
    adjustCreditsBalance(state, action) {
      if (state.summary) {
        const { amount } = action.payload;
        state.summary.availableBalance = Math.max(0, (state.summary.availableBalance || 0) - amount);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchCredits
      .addCase(fetchCredits.pending, (state) => {
        state.summaryLoading = true;
        state.summaryError = "";
      })
      .addCase(fetchCredits.fulfilled, (state, action) => {
        state.summaryLoading = false;
        state.summary = action.payload;
        state.summaryLoaded = true;
      })
      .addCase(fetchCredits.rejected, (state, action) => {
        state.summaryLoading = false;
        state.summaryError = action.payload || "Failed to load credits";
      })

      // fetchEligibleTrees
      .addCase(fetchEligibleTrees.pending, (state) => {
        state.eligibleTreesLoading = true;
        state.eligibleTreesError = "";
      })
      .addCase(fetchEligibleTrees.fulfilled, (state, action) => {
        state.eligibleTreesLoading = false;
        state.eligibleTrees = action.payload;
      })
      .addCase(fetchEligibleTrees.rejected, (state, action) => {
        state.eligibleTreesLoading = false;
        state.eligibleTreesError = action.payload || "Failed to load trees";
      })

      // issueCreditsForTree
      .addCase(issueCreditsForTree.pending, (state) => {
        state.issuingCredits = true;
        state.issuingError = "";
      })
      .addCase(issueCreditsForTree.fulfilled, (state, action) => {
        state.issuingCredits = false;
        if (action.payload?.credits) {
          state.summary = action.payload.credits;
        }
        // Mark tree as no longer eligible (refresh will update properly)
        const treeId = action.meta.arg.treeId;
        state.eligibleTrees = state.eligibleTrees.map((t) =>
          t.id === treeId ? { ...t, canIssue: false } : t
        );
      })
      .addCase(issueCreditsForTree.rejected, (state, action) => {
        state.issuingCredits = false;
        state.issuingError = action.payload || "Failed to issue credits";
      })

      // retireCredits
      .addCase(retireCredits.pending, (state) => {
        state.retiringCredits = true;
        state.retiringError = "";
      })
      .addCase(retireCredits.fulfilled, (state, action) => {
        state.retiringCredits = false;
        if (action.payload?.credits) {
          state.summary = action.payload.credits;
        }
        if (action.payload?.retirement) {
          state.retirements = [action.payload.retirement, ...state.retirements];
        }
      })
      .addCase(retireCredits.rejected, (state, action) => {
        state.retiringCredits = false;
        state.retiringError = action.payload || "Failed to retire credits";
      })

      // transferCredits
      .addCase(transferCredits.pending, (state) => {
        state.transferringCredits = true;
        state.transferringError = "";
      })
      .addCase(transferCredits.fulfilled, (state, action) => {
        state.transferringCredits = false;
        if (action.payload?.credits) {
          state.summary = action.payload.credits;
        }
      })
      .addCase(transferCredits.rejected, (state, action) => {
        state.transferringCredits = false;
        state.transferringError = action.payload || "Failed to transfer credits";
      })

      // fetchHistory
      .addCase(fetchHistory.pending, (state) => {
        state.historyLoading = true;
        state.historyError = "";
      })
      .addCase(fetchHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.history = action.payload?.transactions || [];
        state.historyPagination = action.payload?.pagination || {
          limit: 50,
          offset: 0,
          hasMore: false,
        };
      })
      .addCase(fetchHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.historyError = action.payload || "Failed to load history";
      })

      // fetchRetirements
      .addCase(fetchRetirements.pending, (state) => {
        state.retirementsLoading = true;
        state.retirementsError = "";
      })
      .addCase(fetchRetirements.fulfilled, (state, action) => {
        state.retirementsLoading = false;
        state.retirements = action.payload;
      })
      .addCase(fetchRetirements.rejected, (state, action) => {
        state.retirementsLoading = false;
        state.retirementsError = action.payload || "Failed to load retirements";
      });
  },
});

export const { 
  clearCreditsState, 
  clearErrors,
  invalidateCredits,
  adjustCreditsBalance,
} = creditsSlice.actions;

// ============================================================
// Selectors
// ============================================================

export const selectCreditsSummary = (state) => state.credits.summary;
export const selectCreditsLoading = (state) => state.credits.summaryLoading;
export const selectCreditsError = (state) => state.credits.summaryError;
export const selectCreditsLoaded = (state) => state.credits.summaryLoaded;

export const selectEligibleTrees = (state) => state.credits.eligibleTrees;
export const selectEligibleTreesLoading = (state) => state.credits.eligibleTreesLoading;

export const selectHistory = (state) => state.credits.history;
export const selectHistoryLoading = (state) => state.credits.historyLoading;

export const selectRetirements = (state) => state.credits.retirements;
export const selectRetirementsLoading = (state) => state.credits.retirementsLoading;

export const selectIssuingCredits = (state) => state.credits.issuingCredits;
export const selectIssuingError = (state) => state.credits.issuingError;

export const selectRetiringCredits = (state) => state.credits.retiringCredits;
export const selectRetiringError = (state) => state.credits.retiringError;

export const selectTransferringCredits = (state) => state.credits.transferringCredits;
export const selectTransferringError = (state) => state.credits.transferringError;

export default creditsSlice.reducer;
