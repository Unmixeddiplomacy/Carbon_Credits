import { useEffect, useCallback, useRef } from "react";
import { useGetCreditsQuery } from "../store/api/creditsApi";

/**
 * Production-grade credits subscription hook with:
 * - Configurable polling interval
 * - Visibility-based refresh (when tab becomes visible)
 * - Focus-based refresh (when window regains focus)
 * - Automatic pause when tab is hidden (saves bandwidth)
 * - Manual refresh capability
 * 
 * @param {Object} options Configuration options
 * @param {number} options.pollingInterval - Polling interval in ms (default: 30000 = 30s)
 * @param {boolean} options.pauseWhenHidden - Pause polling when tab is hidden (default: true)
 * @param {boolean} options.refetchOnFocus - Refetch when window gains focus (default: true)
 * @param {boolean} options.refetchOnVisible - Refetch when tab becomes visible (default: true)
 * @param {boolean} options.skip - Skip the query entirely (default: false)
 */
export function useCreditsPolling(options = {}) {
  const {
    pollingInterval = 30000, // 30 seconds default
    pauseWhenHidden = true,
    refetchOnFocus = true,
    refetchOnVisible = true,
    skip = false,
  } = options;

  const isHiddenRef = useRef(document.hidden);
  const lastRefetchRef = useRef(Date.now());

  // Use RTK Query with conditional polling
  const {
    data: credits,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetCreditsQuery(undefined, {
    skip,
    pollingInterval: pauseWhenHidden && isHiddenRef.current ? 0 : pollingInterval,
    refetchOnFocus,
    refetchOnReconnect: true,
  });

  // Throttled refetch to prevent excessive API calls
  const throttledRefetch = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefetch = now - lastRefetchRef.current;
    const minInterval = 2000; // Minimum 2 seconds between refetches

    if (timeSinceLastRefetch >= minInterval) {
      lastRefetchRef.current = now;
      refetch();
    }
  }, [refetch]);

  // Handle visibility change
  useEffect(() => {
    if (!refetchOnVisible) return;

    const handleVisibilityChange = () => {
      const wasHidden = isHiddenRef.current;
      isHiddenRef.current = document.hidden;

      // Refetch when tab becomes visible (was hidden, now visible)
      if (wasHidden && !document.hidden && !skip) {
        throttledRefetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refetchOnVisible, skip, throttledRefetch]);

  // Handle window focus (separate from RTK Query's built-in)
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleFocus = () => {
      if (!skip && !document.hidden) {
        throttledRefetch();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refetchOnFocus, skip, throttledRefetch]);

  return {
    credits,
    isLoading,
    isFetching,
    isError,
    error: error?.data?.error || error?.message || (isError ? "Failed to load credits" : null),
    refetch: throttledRefetch,
    // Derived state
    availableBalance: credits?.availableBalance ?? 0,
    totalIssued: credits?.totalIssued ?? 0,
    totalRetired: credits?.totalRetired ?? 0,
    totalTransferredIn: credits?.totalTransferredIn ?? 0,
    totalTransferredOut: credits?.totalTransferredOut ?? 0,
    netTransferred: (credits?.totalTransferredIn ?? 0) - (credits?.totalTransferredOut ?? 0),
  };
}

/**
 * Lightweight hook for components that just need credits data without polling
 * Uses RTK Query's caching - will return cached data if available
 */
export function useCreditsData(skip = false) {
  const { data, isLoading, isError, error, refetch } = useGetCreditsQuery(undefined, {
    skip,
    // No polling - relies on cache or explicit refetch
    pollingInterval: 0,
  });

  return {
    credits: data,
    isLoading,
    isError,
    error: error?.data?.error || error?.message || null,
    refetch,
    availableBalance: data?.availableBalance ?? 0,
    totalIssued: data?.totalIssued ?? 0,
    totalRetired: data?.totalRetired ?? 0,
  };
}

export default useCreditsPolling;
