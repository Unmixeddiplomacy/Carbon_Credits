import SummaryCards from "../../components/dashboard/SummaryCards";
import RegisterTree from "../../components/dashboard/RegisterTree";
import OwnedTreesList from "../../components/dashboard/OwnedTreesList";
import UserAnalytics from "../../components/dashboard/UserAnalytics";
import { useAuth } from "../../context/AuthContext";
import SectionHeader from "../../components/ui/SectionHeader";
import PageContainer from "../../components/layout/PageContainer";
const HomePage = () => {
  const { user } = useAuth();

  return (
    <PageContainer>
      <div className="flex flex-col gap-8 text-neutral-900">
        <SectionHeader
          eyebrow="Overview"
          title={`Welcome back${user?.name ? `, ${user.name}` : ""}.`}
          description="This is your carbon credits workspace — track your trees, credits, and marketplace activity in one place."
        />

        <SummaryCards />

        <UserAnalytics />

        <RegisterTree />

        <OwnedTreesList />
      </div>
    </PageContainer>
  );
};

export default HomePage;
