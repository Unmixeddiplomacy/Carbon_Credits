import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * RTK Query API for credits with automatic caching, polling, and invalidation
 */
export const creditsApi = createApi({
  reducerPath: "creditsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:3000/api",
    credentials: "include",
  }),
  tagTypes: ["Credits", "CreditHistory", "EligibleTrees", "Retirements"],
  
  // Refetch on window focus and reconnect for real-time data
  refetchOnFocus: true,
  refetchOnReconnect: true,

  endpoints: (builder) => ({
    // =====================================================
    // QUERIES
    // =====================================================

    /**
     * Fetch current user's credit summary
     */
    getCredits: builder.query({
      query: () => "/credits",
      transformResponse: (response) => response?.credits || null,
      providesTags: ["Credits"],
      // Keep data cached for 60 seconds before marking as stale
      keepUnusedDataFor: 60,
    }),

    /**
     * Fetch trees eligible for credit issuance
     */
    getEligibleTrees: builder.query({
      query: () => "/credits/eligible-trees",
      transformResponse: (response) => response?.trees || [],
      providesTags: ["EligibleTrees"],
      keepUnusedDataFor: 30,
    }),

    /**
     * Fetch transaction history with pagination
     */
    getCreditHistory: builder.query({
      query: ({ limit = 50, offset = 0 } = {}) =>
        `/credits/history?limit=${limit}&offset=${offset}`,
      transformResponse: (response) => ({
        transactions: response?.transactions || [],
        pagination: response?.pagination || { limit: 50, offset: 0, hasMore: false },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.transactions.map(({ id }) => ({ type: "CreditHistory", id })),
              { type: "CreditHistory", id: "LIST" },
            ]
          : [{ type: "CreditHistory", id: "LIST" }],
      keepUnusedDataFor: 30,
    }),

    /**
     * Fetch retirement certificates
     */
    getRetirements: builder.query({
      query: () => "/credits/retirements",
      transformResponse: (response) => response?.retirements || [],
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Retirements", id })),
              { type: "Retirements", id: "LIST" },
            ]
          : [{ type: "Retirements", id: "LIST" }],
      keepUnusedDataFor: 60,
    }),

    // =====================================================
    // MUTATIONS
    // =====================================================

    /**
     * Issue credits for a tree
     */
    issueCredits: builder.mutation({
      query: ({ treeId, txHash }) => ({
        url: "/credits/issue",
        method: "POST",
        body: { treeId, txHash },
      }),
      // Invalidate all related caches after issuance
      invalidatesTags: ["Credits", "EligibleTrees", { type: "CreditHistory", id: "LIST" }],
      // Optimistic update for immediate UI feedback
      async onQueryStarted({ treeId }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Update credits summary with server response
          if (data?.credits) {
            dispatch(
              creditsApi.util.updateQueryData("getCredits", undefined, () => data.credits)
            );
          }
        } catch {
          // Revert handled by invalidation
        }
      },
    }),

    /**
     * Retire credits
     */
    retireCredits: builder.mutation({
      query: ({ amount, reason, beneficiaryName, txHash }) => ({
        url: "/credits/retire",
        method: "POST",
        body: { amount, reason, beneficiaryName, txHash },
      }),
      invalidatesTags: ["Credits", { type: "CreditHistory", id: "LIST" }, { type: "Retirements", id: "LIST" }],
      // Optimistic update - immediately subtract from available balance
      async onQueryStarted({ amount }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          creditsApi.util.updateQueryData("getCredits", undefined, (draft) => {
            if (draft) {
              draft.availableBalance = Math.max(0, (draft.availableBalance || 0) - amount);
              draft.totalRetired = (draft.totalRetired || 0) + amount;
            }
          })
        );
        try {
          const { data } = await queryFulfilled;
          // Replace with actual server response
          if (data?.credits) {
            dispatch(
              creditsApi.util.updateQueryData("getCredits", undefined, () => data.credits)
            );
          }
        } catch {
          patchResult.undo();
        }
      },
    }),

    /**
     * Transfer credits to another user
     */
    transferCredits: builder.mutation({
      query: ({ toEmail, toWalletAddress, amount, memo, txHash }) => ({
        url: "/credits/transfer",
        method: "POST",
        body: { toEmail, toWalletAddress, amount, memo, txHash },
      }),
      invalidatesTags: ["Credits", { type: "CreditHistory", id: "LIST" }],
      // Optimistic update for transfer
      async onQueryStarted({ amount }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          creditsApi.util.updateQueryData("getCredits", undefined, (draft) => {
            if (draft) {
              draft.availableBalance = Math.max(0, (draft.availableBalance || 0) - amount);
              draft.totalTransferredOut = (draft.totalTransferredOut || 0) + amount;
            }
          })
        );
        try {
          const { data } = await queryFulfilled;
          if (data?.credits) {
            dispatch(
              creditsApi.util.updateQueryData("getCredits", undefined, () => data.credits)
            );
          }
        } catch {
          patchResult.undo();
        }
      },
    }),
  }),
});

// Export hooks for usage in components
export const {
  useGetCreditsQuery,
  useGetEligibleTreesQuery,
  useGetCreditHistoryQuery,
  useGetRetirementsQuery,
  useIssueCreditsMutation,
  useRetireCreditsMutation,
  useTransferCreditsMutation,
} = creditsApi;

// Export utility for manual cache operations
export const { invalidateTags, resetApiState } = creditsApi.util;
