import { useEffect, useMemo, useState } from "react";
import apiClient from "../../api/client";
import Card from "../../components/ui/Card";
import SectionHeader from "../../components/ui/SectionHeader";
import Sparkline from "../../components/admin/Sparkline";
import LineChart from "../../components/admin/LineChart";

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

function StatCard({ label, value, helper, series }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-neutral-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-950">{value}</p>
          {helper ? (
            <p className="mt-1 text-xs text-neutral-500">{helper}</p>
          ) : null}
        </div>
        {series ? (
          <div className="shrink-0">
            <Sparkline data={series} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Table({ columns, rows, emptyText = "No data" }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs text-neutral-500">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-4 py-3 text-left font-medium"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.length ? (
              rows.map((row, idx) => (
                <tr key={row.id ?? idx} className="text-neutral-800">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {typeof c.render === "function" ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="px-4 py-6 text-sm text-neutral-500"
                  colSpan={columns.length}
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [deadTrees, setDeadTrees] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [overviewRes, usersRes, deadRes] = await Promise.all([
          apiClient.get("/admin/overview?days=30&limit=10"),
          apiClient.get("/admin/users?limit=10&offset=0"),
          apiClient.get("/admin/trees?status=dead&limit=10&offset=0"),
        ]);

        if (!mounted) return;
        setOverview(overviewRes.data);
        setRecentUsers(usersRes.data?.users ?? []);
        setDeadTrees(deadRes.data?.trees ?? []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || e?.message || "Failed to load admin data");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const counts = overview?.counts ?? {};
    const totals = overview?.totals ?? {};
    const series = overview?.series ?? {};

    return [
      {
        label: "Users",
        value: formatNumber(counts.users),
        helper: "Total registered accounts",
        series: null,
      },
      {
        label: "Trees",
        value: formatNumber(counts.trees),
        helper: "All registered trees",
        series: series.treesRegistered,
      },
      {
        label: "Dead trees",
        value: formatNumber(counts.deadTrees),
        helper: "Marked as dead",
        series: null,
      },
      {
        label: "Transactions",
        value: formatNumber((counts.treeTransactions || 0) + (counts.creditTransactions || 0)),
        helper: "Tree + credit transactions",
        series: series.treeTransactions,
      },
      {
        label: "Credits available",
        value: `${formatNumber(totals.creditsAvailable)} kg`,
        helper: "Total available balance",
        series: null,
      },
      {
        label: "Credits issued",
        value: `${formatNumber(totals.creditsIssued)} kg`,
        helper: "Total ever issued",
        series: series.creditsIssued,
      },
      {
        label: "Credits retired",
        value: `${formatNumber(totals.creditsRetired)} kg`,
        helper: "Total retired",
        series: series.creditsRetired,
      },
      {
        label: "Certificates",
        value: formatNumber(counts.certificates),
        helper: "Off-chain certificates issued",
        series: null,
      },
    ];
  }, [overview]);

  const recentTrees = overview?.recent?.trees ?? [];
  const recentTransactions = overview?.recent?.transactions ?? [];

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Admin"
        title="Monitoring dashboard"
        description="Users, trees, marketplace activity, transactions, and verification signals."
      />

      {loading ? (
        <p className="text-sm text-neutral-500">Loading admin analytics…</p>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && overview ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <StatCard
                key={s.label}
                label={s.label}
                value={s.value}
                helper={s.helper}
                series={s.series}
              />
            ))}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-neutral-900">Analytics charts (last 30 days)</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5 sm:p-6">
                <p className="text-xs font-medium text-neutral-500">Trees registered</p>
                <div className="mt-3">
                  <LineChart data={overview?.series?.treesRegistered} yLabel="Trees/day" />
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <p className="text-xs font-medium text-neutral-500">Transactions completed</p>
                <div className="mt-3">
                  <LineChart data={overview?.series?.treeTransactions} yLabel="Transactions/day" />
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <p className="text-xs font-medium text-neutral-500">Credits issued (kg)</p>
                <div className="mt-3">
                  <LineChart data={overview?.series?.creditsIssued} yLabel="kg CO₂/day" />
                </div>
              </Card>

              <Card className="p-5 sm:p-6">
                <p className="text-xs font-medium text-neutral-500">Credits retired (kg)</p>
                <div className="mt-3">
                  <LineChart data={overview?.series?.creditsRetired} yLabel="kg CO₂/day" />
                </div>
              </Card>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Recent trees</h3>
              <Table
                columns={[
                  { key: "id", label: "ID" },
                  { key: "status", label: "Status" },
                  { key: "ownerEmail", label: "Owner" },
                  {
                    key: "totalCreditsAccrued",
                    label: "Accrued (kg)",
                    render: (r) => formatNumber(r.totalCreditsAccrued),
                  },
                ]}
                rows={recentTrees}
                emptyText="No trees yet"
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Recent transactions</h3>
              <Table
                columns={[
                  { key: "kind", label: "Type" },
                  { key: "status", label: "Status" },
                  { key: "sellerEmail", label: "Seller" },
                  { key: "buyerEmail", label: "Buyer" },
                  {
                    key: "credits",
                    label: "Credits (kg)",
                    render: (r) => formatNumber(r.credits),
                  },
                ]}
                rows={recentTransactions}
                emptyText="No transactions yet"
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Dead trees</h3>
              <Table
                columns={[
                  { key: "id", label: "Tree" },
                  { key: "ownerEmail", label: "Owner" },
                  { key: "deathConfirmedAt", label: "Confirmed" },
                ]}
                rows={deadTrees}
                emptyText="No dead trees"
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">Recent users</h3>
              <Table
                columns={[
                  { key: "id", label: "ID" },
                  { key: "email", label: "Email" },
                  { key: "role", label: "Role" },
                  {
                    key: "walletAddress",
                    label: "Wallet",
                    render: (r) => (r.walletAddress ? String(r.walletAddress) : "—"),
                  },
                ]}
                rows={recentUsers}
                emptyText="No users"
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
