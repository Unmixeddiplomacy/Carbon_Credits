import Hero from "../components/landing/Hero";
import Stats from "../components/landing/Stats";
import FeatureHighlight from "../components/landing/FeatureHighlight";
import TrustBar from "../components/landing/TrustBar";
import CTASection from "../components/landing/CTASection";
import PageContainer from "../components/layout/PageContainer";

const LandingPage = () => {
  return (
    <div className="flex min-h-[calc(100vh-4rem-4rem)] flex-col bg-white text-neutral-900">
      <PageContainer>
        <main className="flex flex-1 flex-col gap-10 py-10 sm:py-16">
          <Hero />

          <Stats />

          <FeatureHighlight />

          <TrustBar />

          <CTASection />
        </main>
      </PageContainer>
    </div>
  );
};

export default LandingPage;
