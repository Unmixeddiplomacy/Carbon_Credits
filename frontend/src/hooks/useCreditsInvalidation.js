import { useCallback } from "react";
import { useDispatch } from "react-redux";
import { creditsApi } from "../store/api/creditsApi";

/**
 * Hook to invalidate RTK Query credits cache
 * Use this after mutations to trigger auto-refresh across all subscribed components
 */
export function useCreditsInvalidation() {
  const dispatch = useDispatch();

  const invalidateCredits = useCallback(() => {
    dispatch(creditsApi.util.invalidateTags(["Credits"]));
  }, [dispatch]);

  const invalidateHistory = useCallback(() => {
    dispatch(creditsApi.util.invalidateTags([{ type: "CreditHistory", id: "LIST" }]));
  }, [dispatch]);

  const invalidateEligibleTrees = useCallback(() => {
    dispatch(creditsApi.util.invalidateTags(["EligibleTrees"]));
  }, [dispatch]);

  const invalidateRetirements = useCallback(() => {
    dispatch(creditsApi.util.invalidateTags([{ type: "Retirements", id: "LIST" }]));
  }, [dispatch]);

  const invalidateAll = useCallback(() => {
    dispatch(
      creditsApi.util.invalidateTags([
        "Credits",
        "EligibleTrees",
        { type: "CreditHistory", id: "LIST" },
        { type: "Retirements", id: "LIST" },
      ])
    );
  }, [dispatch]);

  return {
    invalidateCredits,
    invalidateHistory,
    invalidateEligibleTrees,
    invalidateRetirements,
    invalidateAll,
  };
}

export default useCreditsInvalidation;
