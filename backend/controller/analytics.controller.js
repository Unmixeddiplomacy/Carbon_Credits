import pool from "../config/db.js";

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function getDailySeries({ startDate, endDateExclusive, table, dateColumn, whereSql = "", params = [], valueSql = "COUNT(*)::int" }) {
  const sql = `
    WITH days AS (
      SELECT generate_series($1::date, ($2::date - INTERVAL '1 day')::date, INTERVAL '1 day')::date AS day
    ), data AS (
      SELECT date_trunc('day', ${dateColumn})::date AS day,
             ${valueSql} AS value
      FROM ${table}
      WHERE ${dateColumn} >= $1
        AND ${dateColumn} < $2
        ${whereSql}
      GROUP BY 1
    )
    SELECT d.day AS date,
           COALESCE(x.value, 0) AS value
    FROM days d
    LEFT JOIN data x ON x.day = d.day
    ORDER BY d.day ASC;
  `;

  const { rows } = await pool.query(sql, [startDate, endDateExclusive, ...params]);
  return rows;
}

export async function overview(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const days = clamp(toInt(req.query.days, 30), 7, 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const endDateExclusive = new Date();
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);
    endDateExclusive.setHours(0, 0, 0, 0);

    const [
      creditsRow,
      issuedSum,
      retiredSum,
      treesCounts,
      txTreeCounts,
      txCreditCounts,
      certificatesCount,
    ] = await Promise.all([
      pool.query(
        `SELECT available_balance, total_issued, total_retired, total_transferred_in, total_transferred_out
         FROM carbon_credits
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS sum
         FROM credit_issuances
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS sum
         FROM credit_retirements
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM trees
         WHERE owner_user_id = $1
         GROUP BY status`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM tree_transactions
         WHERE status = 'completed' AND (seller_user_id = $1 OR buyer_user_id = $1)`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM credit_transactions
         WHERE status = 'completed' AND (seller_user_id = $1 OR buyer_user_id = $1)`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM certificates
         WHERE issuer_user_id = $1 OR recipient_user_id = $1`,
        [userId]
      ),
    ]);

    const credits = creditsRow.rows[0] || {
      available_balance: 0,
      total_issued: 0,
      total_retired: 0,
      total_transferred_in: 0,
      total_transferred_out: 0,
    };

    const creditsIssued = issuedSum.rows[0]?.sum ?? credits.total_issued ?? 0;
    const creditsRetired = retiredSum.rows[0]?.sum ?? credits.total_retired ?? 0;

    const treesByStatus = treesCounts.rows;
    const totalTrees = treesByStatus.reduce((sum, r) => sum + (r.count || 0), 0);

    const series = {
      treesRegistered: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "trees",
        dateColumn: "created_at",
        whereSql: "AND owner_user_id = $3",
        params: [userId],
      }),
      marketplaceTransactions: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "tree_transactions",
        dateColumn: "created_at",
        whereSql: "AND status = 'completed' AND (seller_user_id = $3 OR buyer_user_id = $3)",
        params: [userId],
      }),
      creditTransactions: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "credit_transactions",
        dateColumn: "created_at",
        whereSql: "AND status = 'completed' AND (seller_user_id = $3 OR buyer_user_id = $3)",
        params: [userId],
      }),
      creditsIssued: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "credit_issuances",
        dateColumn: "created_at",
        whereSql: "AND user_id = $3",
        params: [userId],
        valueSql: "COALESCE(SUM(amount), 0)::numeric",
      }),
      creditsRetired: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "credit_retirements",
        dateColumn: "created_at",
        whereSql: "AND user_id = $3",
        params: [userId],
        valueSql: "COALESCE(SUM(amount), 0)::numeric",
      }),
    };

    return res.json({
      counts: {
        trees: totalTrees,
        treeTransactions: txTreeCounts.rows[0]?.count ?? 0,
        creditTransactions: txCreditCounts.rows[0]?.count ?? 0,
        certificates: certificatesCount.rows[0]?.count ?? 0,
      },
      breakdowns: {
        treesByStatus,
      },
      totals: {
        creditsAvailable: String(credits.available_balance ?? 0),
        creditsIssued: String(creditsIssued),
        creditsRetired: String(creditsRetired),
        creditsTransferredIn: String(credits.total_transferred_in ?? 0),
        creditsTransferredOut: String(credits.total_transferred_out ?? 0),
      },
      series,
    });
  } catch (err) {
    console.error("analytics overview error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
