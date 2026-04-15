import { useEffect, useState } from "react";
import apiClient from "../../api/client";
import Card from "../ui/Card";
import LineChart from "../admin/LineChart";

function ChartCard({ title, children }) {
  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <p className="min-h-8 text-xs font-medium leading-snug text-neutral-500">{title}</p>
      <div className="mt-3 flex flex-1 items-start">
        <div className="w-full">{children}</div>
      </div>
    </Card>
  );
}

export default function UserAnalytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await apiClient.get("/analytics/overview?days=30");
        if (!mounted) return;
        setData(res.data);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || "Failed to load analytics");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading your analytics…</p>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
        <ChartCard title="Trees registered (last 30 days)">
          <LineChart data={data?.series?.treesRegistered} yLabel="Trees/day" />
        </ChartCard>

        <ChartCard title="Marketplace transactions (last 30 days)">
          <LineChart data={data?.series?.marketplaceTransactions} yLabel="Transactions/day" />
        </ChartCard>

        <ChartCard title="Credits issued (kg/day)">
          <LineChart data={data?.series?.creditsIssued} yLabel="kg CO₂/day" />
        </ChartCard>

        <ChartCard title="Credits retired (kg/day)">
          <LineChart data={data?.series?.creditsRetired} yLabel="kg CO₂/day" />
        </ChartCard>
      </div>
    </section>
  );
}
