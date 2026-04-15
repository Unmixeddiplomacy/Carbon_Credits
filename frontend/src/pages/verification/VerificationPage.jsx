import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import TreeVerificationCapture from "../../components/verification/TreeVerificationCapture";
import SectionHeader from "../../components/ui/SectionHeader";
import {
  fetchAllVerificationData,
  submitVerification,
  reportTreeDeath,
  selectVerificationTrees,
  selectVerifications,
  selectDeadTrees,
  selectVerificationLoading,
  selectVerificationError,
  selectVerificationHasLoaded,
  clearError,
} from "../../store/verificationSlice";
import { fetchCredits, adjustCreditsBalance } from "../../store/creditsSlice";
import { useCreditsInvalidation } from "../../hooks/useCreditsInvalidation";

const VerificationPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { invalidateCredits } = useCreditsInvalidation();
  
  // Redux state
  const trees = useSelector(selectVerificationTrees);
  const verifications = useSelector(selectVerifications);
  const deadTrees = useSelector(selectDeadTrees);
  const isLoading = useSelector(selectVerificationLoading);
  const error = useSelector(selectVerificationError);
  const hasLoaded = useSelector(selectVerificationHasLoaded);
  
  // Modal state (local - doesn't need persistence)
  const [selectedTree, setSelectedTree] = useState(null);
  const [isDeathReport, setIsDeathReport] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);

  // Fetch data on mount (only if not already loaded)
  useEffect(() => {
    if (!hasLoaded) {
      dispatch(fetchAllVerificationData());
    }
  }, [dispatch, hasLoaded]);

  // Handle verification submission
  const handleVerificationSubmit = async (data) => {
    try {
      let result;
      if (isDeathReport) {
        result = await dispatch(reportTreeDeath(data)).unwrap();
      } else {
        result = await dispatch(submitVerification(data)).unwrap();
      }
      
      setShowModal(false);
      setSelectedTree(null);
      setIsDeathReport(false);
      setSubmitMessage({
        type: "success",
        text: result.verification?.message || "Verification submitted successfully!",
      });
      
      // Optimistically update credits if we have slash info (death report)
      if (result.verification?.creditAdjustment?.creditsSlashed) {
        dispatch(adjustCreditsBalance({ 
          amount: result.verification.creditAdjustment.creditsSlashed 
        }));
      }
      
      // Refresh verification data and credits after submission
      // This ensures credits are updated whether from:
      // - Initial retroactive credits (first verification)
      // - Slashed credits (death report)
      dispatch(fetchAllVerificationData());
      dispatch(fetchCredits());
      invalidateCredits(); // RTK Query cache invalidation
      
      // Clear message after 5 seconds
      setTimeout(() => setSubmitMessage(null), 5000);
    } catch (err) {
      throw new Error(err || "Failed to submit verification");
    }
  };

  // Open verification modal
  const openVerificationModal = (tree, deathReport = false) => {
    setSelectedTree(tree);
    setIsDeathReport(deathReport);
    setShowModal(true);
    dispatch(clearError());
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "bg-emerald-100 text-emerald-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "needs_review":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading && !hasLoaded) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      </PageContainer>
    );
  }

  const pendingTrees = trees.filter(t => t.status === "pending");
  const activeTrees = trees.filter(t => t.status === "active");

  return (
    <PageContainer>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Tree Verification</h1>
            <p className="text-neutral-600 mt-1">
              Verify your trees periodically to maintain carbon credit eligibility
            </p>
          </div>
          <Button 
            onClick={() => dispatch(fetchAllVerificationData())}
            variant="secondary"
            size="sm"
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Success Message */}
        {submitMessage && (
          <div className={`px-4 py-3 rounded-lg ${
            submitMessage.type === "success" 
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {submitMessage.text}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={() => dispatch(clearError())}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Pending Trees - Need Initial Verification */}
        {pendingTrees.length > 0 && (
          <section>
            <SectionHeader 
              title="⚠️ Pending Verification" 
              subtitle="These trees need initial verification before they can earn credits"
            />
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pendingTrees.map((tree) => (
                <Card key={tree.id} className="flex flex-col border-amber-200 bg-amber-50/50">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-neutral-800">{tree.name}</h3>
                        <p className="text-sm text-neutral-500">ID: #{tree.id}</p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                        Pending
                      </span>
                    </div>
                    
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Absorption Rate</span>
                        <span className="font-medium">{tree.absorptionRate || 0} kg/year</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Registered</span>
                        <span className="font-medium">{formatDate(tree.registeredAt)}</span>
                      </div>
                    </div>
                    
                    <p className="mt-3 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
                      Not earning credits until verified
                    </p>
                  </div>
                  
                  <div className="flex gap-2 mt-4 pt-4 border-t border-amber-200">
                    <Button 
                      onClick={() => openVerificationModal(tree, false)}
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                      size="sm"
                    >
                      Verify Now
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Active Trees */}
        <section>
          <SectionHeader 
            title="Active Trees" 
            subtitle="Select a tree to verify or report as dead"
          />
          
          {activeTrees.length === 0 && pendingTrees.length === 0 ? (
            <Card>
              <p className="text-neutral-500 text-center py-8">
                No trees found. Register a tree to start earning credits.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => navigate("/dashboard")}>
                  Register Tree
                </Button>
              </div>
            </Card>
          ) : activeTrees.length === 0 ? (
            <Card>
              <p className="text-neutral-500 text-center py-6">
                No active trees yet. Complete verification above to activate your trees.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeTrees.map((tree) => (
                <Card key={tree.id} className="flex flex-col">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-neutral-800">{tree.name}</h3>
                        <p className="text-sm text-neutral-500">ID: #{tree.id}</p>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                    
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Absorption Rate</span>
                        <span className="font-medium">{tree.absorptionRate || 0} kg/year</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Total Accrued</span>
                        <span className="font-medium">{(tree.totalCreditsAccrued || 0).toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Last Accrual</span>
                        <span className="font-medium">{formatDate(tree.creditsAccruedUntil)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-6 pt-4 border-t border-neutral-100">
                    <Button 
                      onClick={() => openVerificationModal(tree, false)}
                      className="flex-1"
                      size="sm"
                    >
                      Verify
                    </Button>
                    <Button 
                      onClick={() => openVerificationModal(tree, true)}
                      variant="secondary"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      Report Dead
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent Verifications */}
        <section>
          <SectionHeader 
            title="Verification History" 
            subtitle="Your recent verification submissions"
          />
          
          {verifications.length === 0 ? (
            <Card>
              <p className="text-neutral-500 text-center py-8">
                No verifications yet. Verify a tree to see your history.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Evidence</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Tree</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-neutral-600">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {verifications.slice(0, 10).map((v) => (
                      <tr key={v.id} className="hover:bg-neutral-50">
                        <td className="py-3 px-4">
                          {v.photoUrl ? (
                            <img 
                              src={v.photoUrl} 
                              alt="Verification photo"
                              className="w-12 h-12 object-cover rounded-lg border border-neutral-200 cursor-pointer hover:opacity-80"
                              onClick={() => window.open(v.photoUrl, '_blank')}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center ${v.photoUrl ? 'hidden' : ''}`}
                          >
                            <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-neutral-800">{v.treeName || `Tree #${v.treeId}`}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-neutral-600 capitalize">
                            {(v.type || "verification").replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(v.status)}`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-600">
                          {formatDate(v.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-600">
                          {v.latitude && v.longitude ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              {v.distanceFromTree ? `${v.distanceFromTree}m away` : "Verified"}
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        {/* Dead Trees */}
        {deadTrees.length > 0 && (
          <section>
            <SectionHeader 
              title="Dead Trees" 
              subtitle="Trees no longer earning credits"
            />
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deadTrees.map((tree) => (
                <Card key={tree.id} className="border-red-100 bg-red-50/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral-800">{tree.name}</h3>
                      <p className="text-sm text-neutral-500">{tree.species}</p>
                    </div>
                    <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                      Dead
                    </span>
                  </div>
                  
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Registered</span>
                      <span>{formatDate(tree.registeredAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Death Confirmed</span>
                      <span>{formatDate(tree.deathConfirmedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Total Accrued</span>
                      <span>{(tree.totalCreditsAccrued || 0).toFixed(2)} kg</span>
                    </div>
                    {tree.creditsSlashed && (
                      <div className="flex justify-between text-red-700">
                        <span>Credits Slashed</span>
                        <span>-{tree.creditsSlashed.toFixed(2)} kg</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Verification Modal */}
        {showModal && selectedTree && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <TreeVerificationCapture
                treeId={selectedTree.id}
                treeName={selectedTree.name}
                isDeathReport={isDeathReport}
                onSubmit={handleVerificationSubmit}
                onCancel={() => {
                  setShowModal(false);
                  setSelectedTree(null);
                  setIsDeathReport(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default VerificationPage;
