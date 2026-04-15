import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

const SignupPage = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const data = await register(form);
      if (data?.user) {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      console.error("Error signing up", error);
      const message =
        error.response?.data?.message ||
        "Unable to create account. Please check your details and try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem-4rem)] items-center justify-center bg-white px-4 py-10 text-neutral-900 sm:px-6">
      <div className="w-full max-w-md">
        <SectionHeader
          eyebrow="Join the network"
          title="Create your Carbon Market account"
          description="Start tokenizing trees, trading credits and tracking emissions."
          className="mb-4 text-center"
        />

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <Input
              id="name"
              name="name"
              type="text"
              label="Name"
              required
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
            />

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
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
            />

            {errorMessage && (
              <p className="text-xs text-red-600">{errorMessage}</p>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-neutral-500">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
};

export default SignupPage;
