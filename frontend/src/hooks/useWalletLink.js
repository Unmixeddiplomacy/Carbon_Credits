import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import apiClient from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  finishLinking,
  finishUnlinking,
  resetWallet,
  selectWallet,
  setWalletAddress,
  setWalletError,
  startLinking,
  startUnlinking,
  updateMetamaskAvailability,
} from "../store/walletSlice";

const useWalletLink = () => {
  const { updateUser, user, isHydrated } = useAuth();
  const dispatch = useDispatch();
  const state = useSelector(selectWallet);

  // Hydrate wallet slice from auth user on load/refresh
  useEffect(() => {
    if (!isHydrated) return;
    const addrFromAuth = user?.walletAddress || null;
    if (addrFromAuth && state.walletAddress !== addrFromAuth) {
      dispatch(setWalletAddress(addrFromAuth));
      dispatch(setWalletError(""));
    }
    if (!addrFromAuth && state.walletAddress) {
      // Auth has no wallet but slice does; keep them consistent.
      dispatch(resetWallet());
    }
  }, [dispatch, isHydrated, user?.walletAddress]);

  const connectWallet = useCallback(async () => {
    dispatch(updateMetamaskAvailability());

    if (!state.isMetamaskAvailable) {
      dispatch(setWalletError("MetaMask is not available in this browser."));
      return;
    }

    try {
      dispatch(startLinking());

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const address = accounts?.[0];
      if (!address) {
        dispatch(setWalletError("No account selected in MetaMask."));
        return;
      }

      const nonceResponse = await apiClient.post("/wallet/request-link");
      const nonce = nonceResponse.data?.nonce;
      if (!nonce) {
        dispatch(setWalletError("Failed to get nonce from server."));
        return;
      }

      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [nonce, address],
      });

      const verifyResponse = await apiClient.post("/wallet/verify-link", {
        signature,
        address,
      });

      const linkedAddress = verifyResponse.data?.walletAddress || address;
      dispatch(setWalletAddress(linkedAddress));
      if (updateUser) {
        updateUser({ walletAddress: linkedAddress });
      }
    } catch (err) {
      console.error("Wallet link error", err);
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to link wallet. Please try again.";
      dispatch(setWalletError(message));
    } finally {
      dispatch(finishLinking());
    }
  }, [dispatch, state.isMetamaskAvailable, updateUser]);

  const unlinkWallet = useCallback(async () => {
    try {
      dispatch(startUnlinking());
      dispatch(setWalletError(""));
      await apiClient.post("/wallet/unlink");
      dispatch(resetWallet());
      if (updateUser) {
        updateUser({ walletAddress: null });
      }
    } catch (err) {
      console.error("Wallet unlink error", err);
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Unable to unlink wallet. Please try again.";
      dispatch(setWalletError(message));
    } finally {
      dispatch(finishUnlinking());
    }
  }, [dispatch, updateUser]);

  return {
    ...state,
    connectWallet,
    unlinkWallet,
  };
};

export default useWalletLink;
