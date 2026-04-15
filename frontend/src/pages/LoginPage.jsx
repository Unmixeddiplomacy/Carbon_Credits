import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

const LoginPage = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const data = await login(form);
      if (data?.user) {
        const redirectTo =
          data.user.role === "admin"
            ? "/admin"
            : location.state?.from?.pathname || "/dashboard";
        navigate(redirectTo, { replace: true });
      }
    } catch (error) {
      console.error("Error logging in", error);
      const message =
        error.response?.data?.message ||
        "Unable to log in. Please check your details and try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem-4rem)] items-center justify-center bg-white px-4 py-10 text-neutral-900 sm:px-6">
      <div className="w-full max-w-md">
        <SectionHeader
          eyebrow="Welcome back"
          title="Log in to Carbon Market"
          description="Access your trees, credits and emission dashboard."
          className="mb-4 text-center"
        />

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <Input
              id="email"
              name="email"
              type="email"
              label="Email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>

          {errorMessage && (
            <p className="mt-3 text-center text-xs text-red-600">{errorMessage}</p>
          )}

          <p className="mt-5 text-center text-xs text-neutral-500">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700">
              Sign up
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
};

export default LoginPage;
