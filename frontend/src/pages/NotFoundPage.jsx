import { Link } from "react-router-dom";
import SectionHeader from "../components/ui/SectionHeader";
import Button from "../components/ui/Button";

const NotFoundPage = () => {
  return (
    <main className="flex min-h-[calc(100vh-4rem-4rem)] items-center justify-center bg-white px-4 py-10 text-neutral-900 sm:px-6">
      <div className="max-w-lg text-center">
        <SectionHeader
          eyebrow="404"
          title="We couldn&apos;t find that forest."
          description="The page you&apos;re looking for doesn&apos;t exist. Head back to the marketplace and keep your carbon journey on track."
        />
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button as={Link} to="/" size="sm">
            Back to landing page
          </Button>
          <Button as={Link} to="/marketplace" variant="outline" size="sm">
            Explore marketplace
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFoundPage;
