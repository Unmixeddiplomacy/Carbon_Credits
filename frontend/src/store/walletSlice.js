import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  walletAddress: null,
  isLinking: false,
  isUnlinking: false,
  error: "",
  isMetamaskAvailable: typeof window !== "undefined" && !!window.ethereum,
};

const truncateAddress = (address) => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const walletSlice = createSlice({
  name: "wallet",
  initialState,
  reducers: {
    setWalletAddress(state, action) {
      state.walletAddress = action.payload;
    },
    startLinking(state) {
      state.isLinking = true;
      state.error = "";
    },
    finishLinking(state) {
      state.isLinking = false;
    },
    startUnlinking(state) {
      state.isUnlinking = true;
      state.error = "";
    },
    finishUnlinking(state) {
      state.isUnlinking = false;
    },
    setWalletError(state, action) {
      state.error = action.payload || "";
    },
    updateMetamaskAvailability(state) {
      state.isMetamaskAvailable = typeof window !== "undefined" && !!window.ethereum;
    },
    resetWallet(state) {
      state.walletAddress = null;
      state.error = "";
      state.isLinking = false;
      state.isUnlinking = false;
    },
  },
});

export const {
  setWalletAddress,
  startLinking,
  finishLinking,
  startUnlinking,
  finishUnlinking,
  setWalletError,
  updateMetamaskAvailability,
  resetWallet,
} = walletSlice.actions;

export const selectWallet = (state) => {
  const { walletAddress, isLinking, isUnlinking, error, isMetamaskAvailable } = state.wallet;
  return {
    walletAddress,
    truncatedAddress: walletAddress ? truncateAddress(walletAddress) : null,
    isLinked: Boolean(walletAddress),
    isLinking,
    isUnlinking,
    error,
    isMetamaskAvailable,
  };
};

export default walletSlice.reducer;
