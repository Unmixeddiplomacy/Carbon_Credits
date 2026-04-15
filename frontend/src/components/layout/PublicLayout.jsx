import { Outlet } from "react-router-dom";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import AppHydrator from "./AppHydrator.jsx";

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-neutral-900">
      <AppHydrator />
      <Navbar />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
