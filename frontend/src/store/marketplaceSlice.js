import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiClient from "../api/client";

// Fetch all active marketplace listings
export const fetchListings = createAsyncThunk(
  "marketplace/fetchListings",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.species) params.append("species", filters.species);
      if (filters.minPrice) params.append("minPrice", filters.minPrice);
      if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
      if (filters.minCredits) params.append("minCredits", filters.minCredits);
      if (filters.minAge) params.append("minAge", filters.minAge);
      if (filters.sortBy) params.append("sortBy", filters.sortBy);
      if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.offset) params.append("offset", filters.offset);

      const queryString = params.toString();
      const url = queryString ? `/marketplace/listings?${queryString}` : "/marketplace/listings";
      
      const res = await apiClient.get(url);
      return res.data;
    } catch (err) {
      console.error("fetchListings error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load marketplace listings."
      );
    }
  }
);

// Fetch user's own listings
export const fetchMyListings = createAsyncThunk(
  "marketplace/fetchMyListings",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/marketplace/my-listings");
      return res.data?.listings || [];
    } catch (err) {
      console.error("fetchMyListings error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load your listings."
      );
    }
  }
);

// Fetch user's purchases
export const fetchMyPurchases = createAsyncThunk(
  "marketplace/fetchMyPurchases",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/marketplace/my-purchases");
      return res.data?.purchases || [];
    } catch (err) {
      console.error("fetchMyPurchases error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load your purchases."
      );
    }
  }
);

// Fetch user's sales
export const fetchMySales = createAsyncThunk(
  "marketplace/fetchMySales",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/marketplace/my-sales");
      return res.data?.sales || [];
    } catch (err) {
      console.error("fetchMySales error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load your sales."
      );
    }
  }
);

// Check if a tree is eligible for listing
export const checkListingEligibility = createAsyncThunk(
  "marketplace/checkEligibility",
  async (treeId, thunkAPI) => {
    try {
      const res = await apiClient.get(`/marketplace/check-eligibility/${treeId}`);
      return { treeId, ...res.data };
    } catch (err) {
      console.error("checkEligibility error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to check eligibility."
      );
    }
  }
);

// List a tree for sale
export const listTreeForSale = createAsyncThunk(
  "marketplace/listTree",
  async ({ treeId, priceCredits, description }, thunkAPI) => {
    try {
      const res = await apiClient.post("/marketplace/list", {
        treeId,
        price: priceCredits, // Backend expects 'price' not 'priceCredits'
        description,
      });
      return res.data;
    } catch (err) {
      console.error("listTreeForSale error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to list tree for sale."
      );
    }
  }
);

// Buy a listed tree
export const buyTree = createAsyncThunk(
  "marketplace/buyTree",
  async (listingId, thunkAPI) => {
    try {
      const res = await apiClient.post(`/marketplace/buy/${listingId}`);
      return res.data;
    } catch (err) {
      console.error("buyTree error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to complete purchase."
      );
    }
  }
);

// Cancel a listing
export const cancelListing = createAsyncThunk(
  "marketplace/cancelListing",
  async (listingId, thunkAPI) => {
    try {
      const res = await apiClient.post(`/marketplace/cancel/${listingId}`);
      return { listingId, ...res.data };
    } catch (err) {
      console.error("cancelListing error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to cancel listing."
      );
    }
  }
);

// ============================================================
// Credit Marketplace Thunks
// ============================================================

// Fetch active credit listings
export const fetchCreditListings = createAsyncThunk(
  "marketplace/fetchCreditListings",
  async (filters = {}, thunkAPI) => {
    try {
      const params = new URLSearchParams();
      if (filters.minPrice) params.append("minPrice", filters.minPrice);
      if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
      if (filters.sortBy) params.append("sortBy", filters.sortBy);
      if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);
      if (filters.limit) params.append("limit", filters.limit);
      if (filters.offset) params.append("offset", filters.offset);

      const qs = params.toString();
      const url = qs ? `/marketplace/credits/listings?${qs}` : "/marketplace/credits/listings";
      const res = await apiClient.get(url);
      return res.data;
    } catch (err) {
      console.error("fetchCreditListings error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load credit listings."
      );
    }
  }
);

// List credits for sale
export const listCreditsForSale = createAsyncThunk(
  "marketplace/listCredits",
  async ({ amount, pricePerUnit, description }, thunkAPI) => {
    try {
      const res = await apiClient.post("/marketplace/credits/list", {
        amount,
        pricePerUnit,
        description,
      });
      return res.data;
    } catch (err) {
      console.error("listCreditsForSale error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to list credits for sale."
      );
    }
  }
);

// Buy credits from a listing
export const buyCreditListing = createAsyncThunk(
  "marketplace/buyCredits",
  async ({ listingId, amount }, thunkAPI) => {
    try {
      const res = await apiClient.post(`/marketplace/credits/buy/${listingId}`, { amount });
      return res.data;
    } catch (err) {
      console.error("buyCreditListing error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to purchase credits."
      );
    }
  }
);

// Cancel a credit listing
export const cancelCreditListing = createAsyncThunk(
  "marketplace/cancelCreditListing",
  async (listingId, thunkAPI) => {
    try {
      const res = await apiClient.post(`/marketplace/credits/cancel/${listingId}`);
      return { listingId, ...res.data };
    } catch (err) {
      console.error("cancelCreditListing error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to cancel credit listing."
      );
    }
  }
);

// Fetch user's credit listings
export const fetchMyCreditListings = createAsyncThunk(
  "marketplace/fetchMyCreditListings",
  async (_, thunkAPI) => {
    try {
      const res = await apiClient.get("/marketplace/credits/my-listings");
      return res.data?.listings || [];
    } catch (err) {
      console.error("fetchMyCreditListings error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load your credit listings."
      );
    }
  }
);

// Fetch all user transactions (unified)
export const fetchTransactions = createAsyncThunk(
  "marketplace/fetchTransactions",
  async ({ limit = 50, offset = 0 } = {}, thunkAPI) => {
    try {
      const res = await apiClient.get(`/marketplace/transactions?limit=${limit}&offset=${offset}`);
      return res.data;
    } catch (err) {
      console.error("fetchTransactions error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load transactions."
      );
    }
  }
);

// Fetch a single certificate by its number
export const fetchCertificate = createAsyncThunk(
  "marketplace/fetchCertificate",
  async (certificateNumber, thunkAPI) => {
    try {
      const res = await apiClient.get(`/marketplace/certificates/${certificateNumber}`);
      return res.data?.certificate || null;
    } catch (err) {
      console.error("fetchCertificate error", err);
      return thunkAPI.rejectWithValue(
        err?.response?.data?.error || "Unable to load certificate."
      );
    }
  }
);

const marketplaceSlice = createSlice({
  name: "marketplace",
  initialState: {
    // All listings
    listings: [],
    listingsLoading: false,
    listingsError: "",
    listingsHasLoaded: false,
    totalListings: 0,

    // User's listings
    myListings: [],
    myListingsLoading: false,
    myListingsError: "",

    // User's purchases
    myPurchases: [],
    myPurchasesLoading: false,
    myPurchasesError: "",

    // User's sales
    mySales: [],
    mySalesLoading: false,
    mySalesError: "",

    // Eligibility check
    eligibilityCache: {}, // { treeId: { eligible, reason, ... } }
    eligibilityLoading: false,

    // Actions
    listingInProgress: false,
    buyingInProgress: false,
    cancellingInProgress: false,
    actionError: "",
    actionSuccess: "",

    // Credit listings
    creditListings: [],
    creditListingsLoading: false,
    creditListingsError: "",
    creditListingsHasLoaded: false,

    // User's credit listings
    myCreditListings: [],
    myCreditListingsLoading: false,

    // Transactions (unified)
    transactions: [],
    transactionsLoading: false,
    transactionsError: "",
    transactionsPagination: { total: 0, limit: 50, offset: 0, hasMore: false },

    // Active certificate
    activeCertificate: null,
    certificateLoading: false,
    certificateError: "",
  },
  reducers: {
    clearMarketplace(state) {
      state.listings = [];
      state.listingsError = "";
      state.listingsHasLoaded = false;
      state.myListings = [];
      state.myPurchases = [];
      state.mySales = [];
      state.creditListings = [];
      state.creditListingsHasLoaded = false;
      state.myCreditListings = [];
      state.transactions = [];
    },
    clearActionMessages(state) {
      state.actionError = "";
      state.actionSuccess = "";
    },
    invalidateListings(state) {
      state.listingsHasLoaded = false;
      state.creditListingsHasLoaded = false;
    },
    invalidateTransactions(state) {
      state.transactions = [];
      state.transactionsLoading = false;
    },
    clearCertificate(state) {
      state.activeCertificate = null;
      state.certificateLoading = false;
      state.certificateError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Listings
      .addCase(fetchListings.pending, (state) => {
        state.listingsLoading = true;
        state.listingsError = "";
      })
      .addCase(fetchListings.fulfilled, (state, action) => {
        state.listingsLoading = false;
        state.listings = action.payload?.listings || [];
        state.totalListings = action.payload?.total || 0;
        state.listingsHasLoaded = true;
      })
      .addCase(fetchListings.rejected, (state, action) => {
        state.listingsLoading = false;
        state.listingsError = action.payload || "Unable to load listings.";
      })

      // Fetch My Listings
      .addCase(fetchMyListings.pending, (state) => {
        state.myListingsLoading = true;
        state.myListingsError = "";
      })
      .addCase(fetchMyListings.fulfilled, (state, action) => {
        state.myListingsLoading = false;
        state.myListings = action.payload;
      })
      .addCase(fetchMyListings.rejected, (state, action) => {
        state.myListingsLoading = false;
        state.myListingsError = action.payload || "Unable to load your listings.";
      })

      // Fetch My Purchases
      .addCase(fetchMyPurchases.pending, (state) => {
        state.myPurchasesLoading = true;
        state.myPurchasesError = "";
      })
      .addCase(fetchMyPurchases.fulfilled, (state, action) => {
        state.myPurchasesLoading = false;
        state.myPurchases = action.payload;
      })
      .addCase(fetchMyPurchases.rejected, (state, action) => {
        state.myPurchasesLoading = false;
        state.myPurchasesError = action.payload || "Unable to load purchases.";
      })

      // Fetch My Sales
      .addCase(fetchMySales.pending, (state) => {
        state.mySalesLoading = true;
        state.mySalesError = "";
      })
      .addCase(fetchMySales.fulfilled, (state, action) => {
        state.mySalesLoading = false;
        state.mySales = action.payload;
      })
      .addCase(fetchMySales.rejected, (state, action) => {
        state.mySalesLoading = false;
        state.mySalesError = action.payload || "Unable to load sales.";
      })

      // Check Eligibility
      .addCase(checkListingEligibility.pending, (state) => {
        state.eligibilityLoading = true;
      })
      .addCase(checkListingEligibility.fulfilled, (state, action) => {
        state.eligibilityLoading = false;
        const { treeId, ...eligibility } = action.payload;
        state.eligibilityCache[treeId] = eligibility;
      })
      .addCase(checkListingEligibility.rejected, (state) => {
        state.eligibilityLoading = false;
      })

      // List Tree
      .addCase(listTreeForSale.pending, (state) => {
        state.listingInProgress = true;
        state.actionError = "";
        state.actionSuccess = "";
      })
      .addCase(listTreeForSale.fulfilled, (state, action) => {
        state.listingInProgress = false;
        state.actionSuccess = action.payload?.message || "Tree listed successfully!";
        state.listingsHasLoaded = false; // Invalidate to refresh
      })
      .addCase(listTreeForSale.rejected, (state, action) => {
        state.listingInProgress = false;
        state.actionError = action.payload || "Failed to list tree.";
      })

      // Buy Tree
      .addCase(buyTree.pending, (state) => {
        state.buyingInProgress = true;
        state.actionError = "";
        state.actionSuccess = "";
      })
      .addCase(buyTree.fulfilled, (state, action) => {
        state.buyingInProgress = false;
        state.actionSuccess = action.payload?.message || "Purchase successful!";
        state.listingsHasLoaded = false; // Invalidate to refresh
      })
      .addCase(buyTree.rejected, (state, action) => {
        state.buyingInProgress = false;
        state.actionError = action.payload || "Failed to complete purchase.";
      })

      // Cancel Listing
      .addCase(cancelListing.pending, (state) => {
        state.cancellingInProgress = true;
        state.actionError = "";
        state.actionSuccess = "";
      })
      .addCase(cancelListing.fulfilled, (state, action) => {
        state.cancellingInProgress = false;
        state.actionSuccess = action.payload?.message || "Listing cancelled.";
        // Remove from myListings and listings - backend uses 'id' not 'listingId'
        const cancelledId = action.payload.listingId;
        state.myListings = state.myListings.filter(
          (l) => l.id !== cancelledId && l.listingId !== cancelledId
        );
        state.listings = state.listings.filter(
          (l) => l.id !== cancelledId && l.listingId !== cancelledId
        );
        state.listingsHasLoaded = false; // Invalidate to refresh
      })
      .addCase(cancelListing.rejected, (state, action) => {
        state.cancellingInProgress = false;
        state.actionError = action.payload || "Failed to cancel listing.";
      })

      // ============================================================
      // Credit Marketplace
      // ============================================================

      // Fetch Credit Listings
      .addCase(fetchCreditListings.pending, (state) => {
        state.creditListingsLoading = true;
        state.creditListingsError = "";
      })
      .addCase(fetchCreditListings.fulfilled, (state, action) => {
        state.creditListingsLoading = false;
        state.creditListings = action.payload?.listings || [];
        state.creditListingsHasLoaded = true;
      })
      .addCase(fetchCreditListings.rejected, (state, action) => {
        state.creditListingsLoading = false;
        state.creditListingsError = action.payload || "Unable to load credit listings.";
      })

      // List Credits
      .addCase(listCreditsForSale.pending, (state) => {
        state.listingInProgress = true;
        state.actionError = "";
        state.actionSuccess = "";
      })
      .addCase(listCreditsForSale.fulfilled, (state, action) => {
        state.listingInProgress = false;
        state.actionSuccess = action.payload?.message || "Credits listed successfully!";
        state.creditListingsHasLoaded = false;
      })
      .addCase(listCreditsForSale.rejected, (state, action) => {
        state.listingInProgress = false;
        state.actionError = action.payload || "Failed to list credits.";
      })

      // Buy Credits
      .addCase(buyCreditListing.pending, (state) => {
        state.buyingInProgress = true;
        state.actionError = "";
        state.actionSuccess = "";
      })
      .addCase(buyCreditListing.fulfilled, (state, action) => {
        state.buyingInProgress = false;
        state.actionSuccess = action.payload?.message || "Credits purchased successfully!";
        state.creditListingsHasLoaded = false;
      })
      .addCase(buyCreditListing.rejected, (state, action) => {
        state.buyingInProgress = false;
        state.actionError = action.payload || "Failed to purchase credits.";
      })

      // Cancel Credit Listing
      .addCase(cancelCreditListing.pending, (state) => {
        state.cancellingInProgress = true;
        state.actionError = "";
        state.actionSuccess = "";
      })
      .addCase(cancelCreditListing.fulfilled, (state, action) => {
        state.cancellingInProgress = false;
        state.actionSuccess = action.payload?.message || "Credit listing cancelled.";
        const id = action.payload.listingId;
        state.myCreditListings = state.myCreditListings.filter((l) => l.id !== id);
        state.creditListingsHasLoaded = false;
      })
      .addCase(cancelCreditListing.rejected, (state, action) => {
        state.cancellingInProgress = false;
        state.actionError = action.payload || "Failed to cancel credit listing.";
      })

      // Fetch My Credit Listings
      .addCase(fetchMyCreditListings.pending, (state) => {
        state.myCreditListingsLoading = true;
      })
      .addCase(fetchMyCreditListings.fulfilled, (state, action) => {
        state.myCreditListingsLoading = false;
        state.myCreditListings = action.payload;
      })
      .addCase(fetchMyCreditListings.rejected, (state) => {
        state.myCreditListingsLoading = false;
      })

      // Fetch Transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.transactionsLoading = true;
        state.transactionsError = "";
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.transactionsLoading = false;
        state.transactions = action.payload?.transactions || [];
        state.transactionsPagination = action.payload?.pagination || state.transactionsPagination;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.transactionsLoading = false;
        state.transactionsError = action.payload || "Unable to load transactions.";
      })

      // Fetch Certificate
      .addCase(fetchCertificate.pending, (state) => {
        state.certificateLoading = true;
        state.certificateError = "";
      })
      .addCase(fetchCertificate.fulfilled, (state, action) => {
        state.certificateLoading = false;
        state.activeCertificate = action.payload;
      })
      .addCase(fetchCertificate.rejected, (state, action) => {
        state.certificateLoading = false;
        state.certificateError = action.payload || "Unable to load certificate.";
      });
  },
});

export const { clearMarketplace, clearActionMessages, invalidateListings, invalidateTransactions, clearCertificate } =
  marketplaceSlice.actions;

// Selectors
export const selectListings = (state) => state.marketplace.listings;
export const selectListingsLoading = (state) => state.marketplace.listingsLoading;
export const selectListingsError = (state) => state.marketplace.listingsError;
export const selectMyListings = (state) => state.marketplace.myListings;
export const selectMyPurchases = (state) => state.marketplace.myPurchases;
export const selectMySales = (state) => state.marketplace.mySales;
export const selectEligibilityCache = (state) => state.marketplace.eligibilityCache;
export const selectActionInProgress = (state) =>
  state.marketplace.listingInProgress ||
  state.marketplace.buyingInProgress ||
  state.marketplace.cancellingInProgress;
export const selectActionError = (state) => state.marketplace.actionError;
export const selectActionSuccess = (state) => state.marketplace.actionSuccess;

// Credit marketplace selectors
export const selectCreditListings = (state) => state.marketplace.creditListings;
export const selectCreditListingsLoading = (state) => state.marketplace.creditListingsLoading;
export const selectCreditListingsError = (state) => state.marketplace.creditListingsError;
export const selectMyCreditListings = (state) => state.marketplace.myCreditListings;

// Transactions selectors
export const selectTransactions = (state) => state.marketplace.transactions;
export const selectTransactionsLoading = (state) => state.marketplace.transactionsLoading;
export const selectTransactionsError = (state) => state.marketplace.transactionsError;
export const selectTransactionsPagination = (state) => state.marketplace.transactionsPagination;

// Certificate selectors
export const selectActiveCertificate = (state) => state.marketplace.activeCertificate;
export const selectCertificateLoading = (state) => state.marketplace.certificateLoading;
export const selectCertificateError = (state) => state.marketplace.certificateError;

export default marketplaceSlice.reducer;
