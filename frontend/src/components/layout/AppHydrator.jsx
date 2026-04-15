import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../context/AuthContext";
import {
  setWalletAddress,
  resetWallet,
  setWalletError,
  selectWallet,
} from "../../store/walletSlice";
import { clearTrees } from "../../store/treesSlice";
import { clearCreditsState } from "../../store/creditsSlice";
import { clearMarketplace } from "../../store/marketplaceSlice";

export default function AppHydrator() {
  const dispatch = useDispatch();
  const { user, isHydrated } = useAuth();
  const wallet = useSelector(selectWallet);

  useEffect(() => {
    if (!isHydrated) return;
    const addr = user?.walletAddress || null;
    if (addr && wallet.walletAddress !== addr) {
      dispatch(setWalletAddress(addr));
      dispatch(setWalletError(""));
    }
    if (!addr && wallet.walletAddress) {
      dispatch(resetWallet());
    }

    if (!user) {
      // Clear any user-specific cached data on logout
      dispatch(clearTrees());
      dispatch(clearCreditsState());
      dispatch(clearMarketplace());
    }
  }, [dispatch, isHydrated, user, wallet.walletAddress]);

  return null;
}
