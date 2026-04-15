import PageContainer from "../../components/layout/PageContainer";
import SectionHeader from "../../components/ui/SectionHeader";
import {
  CreditsSummary,
  AccrualStatus,
  RetireCredits,
  CreditsHistory,
} from "../../components/credits";

const CreditsPage = () => {
  return (
    <PageContainer>
      <div className="flex flex-col gap-8 text-neutral-900">
        <SectionHeader
          eyebrow="Carbon Credits"
          title="Credit Management"
          description="Your credits accrue automatically from verified trees. Retire them to claim carbon offsets or transfer to others."
        />

        {/* Summary Cards */}
        <CreditsSummary />

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Accrual Status */}
          <div className="space-y-6">
            <AccrualStatus />
          </div>

          {/* Right Column: Retire Credits */}
          <div className="space-y-6">
            <RetireCredits />
          </div>
        </div>

        {/* Transaction History */}
        <CreditsHistory />
      </div>
    </PageContainer>
  );
};

export default CreditsPage;
