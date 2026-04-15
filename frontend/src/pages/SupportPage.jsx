import { useMemo, useState } from "react";
import PageContainer from "../components/layout/PageContainer.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";

export default function SupportPage() {
  const [form, setForm] = useState({ name: "", email: "", topic: "general", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const e = {};
    if (!form.name.trim()) e.name = "Your name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (!form.message.trim() || form.message.trim().length < 20)
      e.message = "Please provide at least 20 characters so we can help.";
    return e;
  }, [form]);

  const onChange = (evt) => {
    const { name, value } = evt.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onSubmit = (evt) => {
    evt.preventDefault();
    if (Object.keys(errors).length > 0) return;
    // In a real app, submit to backend here
    setSubmitted(true);
  };

  return (
    <PageContainer>
      <div className="space-y-10">
        {/* Intro */}
        <SectionHeader
          eyebrow="Support"
          title="How can we help?"
          description="Find quick answers, explore docs, or contact our team. We usually reply within one business day."
        />

        {/* Quick resources */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="h-full">
            <div className="flex h-full flex-col gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">📚</div>
              <h3 className="text-sm font-semibold text-neutral-900">Documentation</h3>
              <p className="text-xs text-neutral-600">Learn how credits, trees, and wallets work across the platform.</p>
              <a href="#" className="mt-auto text-xs font-medium text-emerald-700 hover:text-emerald-800">Browse docs →</a>
            </div>
          </Card>
          <Card className="h-full">
            <div className="flex h-full flex-col gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">❓</div>
              <h3 className="text-sm font-semibold text-neutral-900">FAQ</h3>
              <p className="text-xs text-neutral-600">Answers to common questions about registering and trading trees.</p>
              <a href="#" className="mt-auto text-xs font-medium text-emerald-700 hover:text-emerald-800">Read FAQs →</a>
            </div>
          </Card>
          <Card className="h-full">
            <div className="flex h-full flex-col gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">🧭</div>
              <h3 className="text-sm font-semibold text-neutral-900">Getting Started</h3>
              <p className="text-xs text-neutral-600">Step-by-step guide to link your wallet and register your first tree.</p>
              <a href="#" className="mt-auto text-xs font-medium text-emerald-700 hover:text-emerald-800">Start here →</a>
            </div>
          </Card>
          <Card className="h-full">
            <div className="flex h-full flex-col gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">💬</div>
              <h3 className="text-sm font-semibold text-neutral-900">Community</h3>
              <p className="text-xs text-neutral-600">Join discussions, share ideas, and get tips from other users.</p>
              <a href="#" className="mt-auto text-xs font-medium text-emerald-700 hover:text-emerald-800">Join community →</a>
            </div>
          </Card>
        </div>

        {/* Contact form */}
        <Card>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-1">
              <h3 className="text-sm font-semibold text-neutral-900">Contact Support</h3>
              <p className="text-xs text-neutral-600">
                Can’t find what you need? Send us a message and we’ll get back to you shortly.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-neutral-600">
                <li>• Hours: Mon–Fri, 9am–6pm</li>
                <li>• Typical reply: within 24 hours</li>
              </ul>
            </div>

            <form onSubmit={onSubmit} className="lg:col-span-2">
              {submitted ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Thanks! Your message has been sent. We’ll reply soon.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    id="name"
                    label="Name"
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    placeholder="Jane Doe"
                  />
                  <Input
                    id="email"
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    placeholder="jane@example.com"
                  />
                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="topic" className="block text-xs font-medium text-neutral-700">
                      Topic
                    </label>
                    <select
                      id="topic"
                      name="topic"
                      value={form.topic}
                      onChange={onChange}
                      className="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-900"
                    >
                      <option value="general">General</option>
                      <option value="account">Account & Wallet</option>
                      <option value="trees">Tree Registration</option>
                      <option value="market">Marketplace</option>
                      <option value="billing">Billing</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <label htmlFor="message" className="block text-xs font-medium text-neutral-700">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      value={form.message}
                      onChange={onChange}
                      placeholder="Share details about your request..."
                      className="block w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-neutral-900"
                    />
                  </div>

                  {/* Errors */}
                  {(errors.name || errors.email || errors.message) && (
                    <div className="sm:col-span-2 space-y-1 text-xs">
                      {errors.name && (
                        <p className="text-red-600">• {errors.name}</p>
                      )}
                      {errors.email && (
                        <p className="text-red-600">• {errors.email}</p>
                      )}
                      {errors.message && (
                        <p className="text-red-600">• {errors.message}</p>
                      )}
                    </div>
                  )}

                  <div className="sm:col-span-2 flex items-center justify-between">
                    <p className="text-xs text-neutral-500">We’ll use your email to reply.</p>
                    <Button type="submit" variant="primary" size="md">
                      Send message
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </Card>

        {/* Extra help */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="flex items-start gap-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">🛠️</div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900">System Status</h3>
                <p className="mt-1 text-xs text-neutral-600">All systems are operational. Check real‑time updates on deployments and the blockchain indexer.</p>
                <a href="#" className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:text-emerald-800">View status →</a>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-start gap-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">🧾</div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-neutral-900">Contact Sales</h3>
                <p className="mt-1 text-xs text-neutral-600">Need a custom plan or enterprise support? Talk to our team.</p>
                <a href="#" className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:text-emerald-800">Get in touch →</a>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
