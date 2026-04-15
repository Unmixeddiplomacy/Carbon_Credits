import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  fetchAccrualStatus,
  selectVerificationTrees,
  selectLastAccrualRun,
  selectVerificationLoading,
} from "../../store/verificationSlice";
import Card from "../ui/Card";
import Button from "../ui/Button";

/**
 * AccrualStatus - Shows credit accrual information
 * Replaces the old manual IssueCredits component
 * Credits are now issued automatically by the cron job
 */
const AccrualStatus = () => {
  const dispatch = useDispatch();
  const trees = useSelector(selectVerificationTrees);
  const lastAccrualRun = useSelector(selectLastAccrualRun);
  const isLoading = useSelector(selectVerificationLoading);

  useEffect(() => {
    dispatch(fetchAccrualStatus());
  }, [dispatch]);

  const activeTrees = trees.filter((t) => t.status === "active");
  const totalAccrued = activeTrees.reduce((sum, t) => sum + (t.totalCreditsAccrued || 0), 0);
  const totalDailyRate = activeTrees.reduce((sum, t) => sum + ((t.absorptionRate || 0) / 365), 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-200 rounded w-1/3"></div>
          <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
          <div className="h-20 bg-neutral-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-800">Credit Accrual</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Credits accrue daily based on your trees' absorption rates
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-600">
              +{totalDailyRate.toFixed(3)} kg/day
            </div>
            <div className="text-xs text-neutral-500">Daily accrual rate</div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-emerald-800 font-medium">Automatic Credit Issuance</p>
              <p className="text-sm text-emerald-700 mt-1">
                Credits are calculated and issued automatically by our system. Keep your trees verified to maintain eligibility.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neutral-50 rounded-lg p-4">
            <div className="text-sm text-neutral-500">Active Trees</div>
            <div className="text-2xl font-bold text-neutral-800">{activeTrees.length}</div>
          </div>
          <div className="bg-neutral-50 rounded-lg p-4">
            <div className="text-sm text-neutral-500">Total Accrued</div>
            <div className="text-2xl font-bold text-neutral-800">{totalAccrued.toFixed(2)} kg</div>
          </div>
        </div>

        {/* Last Accrual Run */}
        {lastAccrualRun && (
          <div className="border-t border-neutral-200 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">Last System Update</span>
              <span className="text-neutral-700">{formatDate(lastAccrualRun.completed_at || lastAccrualRun.completedAt)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-neutral-500">Status</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                lastAccrualRun.status === "completed" 
                  ? "bg-emerald-100 text-emerald-800"
                  : lastAccrualRun.status === "partial"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}>
                {lastAccrualRun.status}
              </span>
            </div>
          </div>
        )}

        {/* Trees Summary */}
        {activeTrees.length > 0 ? (
          <div className="border-t border-neutral-200 pt-4">
            <h4 className="text-sm font-medium text-neutral-700 mb-3">Your Trees</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeTrees.slice(0, 5).map((tree) => (
                <div key={tree.id} className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-lg">
                  <div>
                    <div className="font-medium text-neutral-800">{tree.name}</div>
                    <div className="text-xs text-neutral-500">{tree.absorptionRate} kg/year</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-emerald-600">
                      {(tree.totalCreditsAccrued || 0).toFixed(2)} kg
                    </div>
                    <div className="text-xs text-neutral-500">accrued</div>
                  </div>
                </div>
              ))}
            </div>
            {activeTrees.length > 5 && (
              <p className="text-sm text-neutral-500 mt-2 text-center">
                +{activeTrees.length - 5} more trees
              </p>
            )}
          </div>
        ) : (
          <div className="border-t border-neutral-200 pt-4 text-center">
            <p className="text-neutral-500 mb-3">No active trees found</p>
            <Link to="/dashboard">
              <Button size="sm">Register a Tree</Button>
            </Link>
          </div>
        )}

        {/* Verification CTA */}
        <div className="border-t border-neutral-200 pt-4">
          <Link to="/verification">
            <Button variant="secondary" className="w-full">
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verify Trees & View Details
              </span>
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
};

export default AccrualStatus;
