import pool from "../config/db.js";

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function hasUsersCreatedAt() {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'created_at'
     LIMIT 1`
  );
  return rows.length > 0;
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
    const days = clamp(toInt(req.query.days, 30), 7, 365);
    const limit = clamp(toInt(req.query.limit, 10), 5, 50);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const endDateExclusive = new Date();
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);
    endDateExclusive.setHours(0, 0, 0, 0);

    const [
      usersCount,
      treesCount,
      deadTreesCount,
      treesByStatus,
      treeListingsActive,
      creditListingsActive,
      treeTxCount,
      creditTxCount,
      certificatesCount,
      certMintByStatus,
      totalCreditsAvailable,
      totalCreditsIssued,
      totalCreditsRetired,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM trees"),
      pool.query("SELECT COUNT(*)::int AS count FROM trees WHERE status = 'dead'"),
      pool.query("SELECT status, COUNT(*)::int AS count FROM trees GROUP BY status"),
      pool.query("SELECT COUNT(*)::int AS count FROM tree_listings WHERE status = 'active'"),
      pool.query("SELECT COUNT(*)::int AS count FROM credit_listings WHERE status = 'active'"),
      pool.query("SELECT COUNT(*)::int AS count FROM tree_transactions"),
      pool.query("SELECT COUNT(*)::int AS count FROM credit_transactions"),
      pool.query("SELECT COUNT(*)::int AS count FROM certificates"),
      pool.query("SELECT mint_status, COUNT(*)::int AS count FROM certificates GROUP BY mint_status"),
      pool.query("SELECT COALESCE(SUM(available_balance), 0)::numeric AS sum FROM carbon_credits"),
      pool.query("SELECT COALESCE(SUM(amount), 0)::numeric AS sum FROM credit_issuances"),
      pool.query("SELECT COALESCE(SUM(amount), 0)::numeric AS sum FROM credit_retirements"),
    ]);

    const series = {
      treesRegistered: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "trees",
        dateColumn: "created_at",
      }),
      treeTransactions: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "tree_transactions",
        dateColumn: "created_at",
        whereSql: "AND status = 'completed'",
      }),
      creditTransactions: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "credit_transactions",
        dateColumn: "created_at",
        whereSql: "AND status = 'completed'",
      }),
      creditsIssued: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "credit_issuances",
        dateColumn: "created_at",
        valueSql: "COALESCE(SUM(amount), 0)::numeric",
      }),
      creditsRetired: await getDailySeries({
        startDate,
        endDateExclusive,
        table: "credit_retirements",
        dateColumn: "created_at",
        valueSql: "COALESCE(SUM(amount), 0)::numeric",
      }),
    };

    const recentTrees = await pool.query(
      `SELECT t.id,
              t.status,
              t.owner_user_id AS "ownerUserId",
              u.email AS "ownerEmail",
              u.name AS "ownerName",
              t.chain_tree_id AS "chainTreeId",
              t.total_credits_accrued AS "totalCreditsAccrued",
              t.created_at AS "createdAt"
       FROM trees t
       JOIN users u ON u.id = t.owner_user_id
       ORDER BY t.id DESC
       LIMIT $1`,
      [limit]
    );

    const recentTransactions = await pool.query(
      `(
        SELECT 'tree'::text AS kind,
               tt.id,
               tt.status,
               tt.sale_price AS price,
               tt.credits_transferred AS credits,
               tt.created_at AS "createdAt",
               s.email AS "sellerEmail",
               b.email AS "buyerEmail",
               tt.tree_id AS "treeId"
        FROM tree_transactions tt
        JOIN users s ON s.id = tt.seller_user_id
        JOIN users b ON b.id = tt.buyer_user_id
      )
      UNION ALL
      (
        SELECT 'credit'::text AS kind,
               ct.id,
               ct.status,
               ct.total_price AS price,
               ct.amount AS credits,
               ct.created_at AS "createdAt",
               s.email AS "sellerEmail",
               b.email AS "buyerEmail",
               NULL::int AS "treeId"
        FROM credit_transactions ct
        JOIN users s ON s.id = ct.seller_user_id
        JOIN users b ON b.id = ct.buyer_user_id
      )
      ORDER BY "createdAt" DESC
      LIMIT $1`,
      [limit]
    );

    return res.json({
      counts: {
        users: usersCount.rows[0].count,
        trees: treesCount.rows[0].count,
        deadTrees: deadTreesCount.rows[0].count,
        treeListingsActive: treeListingsActive.rows[0].count,
        creditListingsActive: creditListingsActive.rows[0].count,
        treeTransactions: treeTxCount.rows[0].count,
        creditTransactions: creditTxCount.rows[0].count,
        certificates: certificatesCount.rows[0].count,
      },
      breakdowns: {
        treesByStatus: treesByStatus.rows,
        certificateMintStatus: certMintByStatus.rows,
      },
      totals: {
        creditsAvailable: String(totalCreditsAvailable.rows[0].sum),
        creditsIssued: String(totalCreditsIssued.rows[0].sum),
        creditsRetired: String(totalCreditsRetired.rows[0].sum),
      },
      series,
      recent: {
        trees: recentTrees.rows,
        transactions: recentTransactions.rows,
      },
    });
  } catch (err) {
    console.error("admin overview error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function listUsers(req, res) {
  try {
    const limit = clamp(toInt(req.query.limit, 50), 1, 200);
    const offset = clamp(toInt(req.query.offset, 0), 0, 1000000);

    const includeCreatedAt = await hasUsersCreatedAt();
    const createdAtSelect = includeCreatedAt ? ", created_at AS \"createdAt\"" : "";
    const orderBy = includeCreatedAt ? "created_at DESC" : "id DESC";

    const { rows } = await pool.query(
      `SELECT id,
              name,
              email,
              role,
              wallet_address AS \"walletAddress\"${createdAtSelect}
       FROM users
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({ users: rows, limit, offset });
  } catch (err) {
    console.error("admin listUsers error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function listTrees(req, res) {
  try {
    const limit = clamp(toInt(req.query.limit, 50), 1, 200);
    const offset = clamp(toInt(req.query.offset, 0), 0, 1000000);
    const status = typeof req.query.status === "string" ? req.query.status : null;

    const params = [];
    let where = "";
    if (status) {
      params.push(status);
      where = `WHERE t.status = $${params.length}`;
    }

    params.push(limit);
    params.push(offset);

    const { rows } = await pool.query(
      `SELECT t.id,
              t.status,
              t.owner_user_id AS \"ownerUserId\",
              u.email AS \"ownerEmail\",
              u.name AS \"ownerName\",
              t.chain_tree_id AS \"chainTreeId\",
              t.total_credits_accrued AS \"totalCreditsAccrued\",
              t.carbon_absorption_kg_per_year AS \"absorptionKgPerYear\",
              t.last_verified_at AS \"lastVerifiedAt\",
              t.verification_required_by AS \"verificationRequiredBy\",
              t.death_confirmed_at AS \"deathConfirmedAt\",
              t.created_at AS \"createdAt\"
       FROM trees t
       JOIN users u ON u.id = t.owner_user_id
       ${where}
       ORDER BY t.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ trees: rows, limit, offset });
  } catch (err) {
    console.error("admin listTrees error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function listTransactions(req, res) {
  try {
    const limit = clamp(toInt(req.query.limit, 50), 1, 200);
    const offset = clamp(toInt(req.query.offset, 0), 0, 1000000);

    const { rows } = await pool.query(
      `WITH tx AS (
        (
          SELECT 'tree'::text AS kind,
                 tt.id,
                 tt.status,
                 tt.sale_price AS price,
                 tt.credits_transferred AS credits,
                 tt.created_at AS "createdAt",
                 s.email AS "sellerEmail",
                 b.email AS "buyerEmail",
                 tt.tree_id AS "treeId"
          FROM tree_transactions tt
          JOIN users s ON s.id = tt.seller_user_id
          JOIN users b ON b.id = tt.buyer_user_id
        )
        UNION ALL
        (
          SELECT 'credit'::text AS kind,
                 ct.id,
                 ct.status,
                 ct.total_price AS price,
                 ct.amount AS credits,
                 ct.created_at AS "createdAt",
                 s.email AS "sellerEmail",
                 b.email AS "buyerEmail",
                 NULL::int AS "treeId"
          FROM credit_transactions ct
          JOIN users s ON s.id = ct.seller_user_id
          JOIN users b ON b.id = ct.buyer_user_id
        )
      )
      SELECT *
      FROM tx
      ORDER BY "createdAt" DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({ transactions: rows, limit, offset });
  } catch (err) {
    console.error("admin listTransactions error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
