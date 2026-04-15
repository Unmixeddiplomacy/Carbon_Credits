import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import walletReducer from "./walletSlice";
import treesReducer from "./treesSlice";
import creditsReducer from "./creditsSlice";
import verificationReducer from "./verificationSlice";
import marketplaceReducer from "./marketplaceSlice";
import { creditsApi } from "./api/creditsApi";

const store = configureStore({
  reducer: {
    wallet: walletReducer,
    trees: treesReducer,
    credits: creditsReducer,
    verification: verificationReducer,
    marketplace: marketplaceReducer,
    // RTK Query reducer
    [creditsApi.reducerPath]: creditsApi.reducer,
  },
  // Add RTK Query middleware for caching, invalidation, polling
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(creditsApi.middleware),
});

// Enable refetchOnFocus and refetchOnReconnect behaviors
setupListeners(store.dispatch);

export default store;
