const { db } = require('./db');

const TIERS = { diamond: 100, gold: 50, silver: 25, bronze: 10 };

function emptyCoins() {
  return { diamond: 0, gold: 0, silver: 0, bronze: 0 };
}

function coinSummary(userId) {
  const rows = db.prepare('SELECT tier, COUNT(*) AS c, SUM(points) AS p FROM awards WHERE user_id = ? GROUP BY tier').all(userId);
  const coins = emptyCoins();
  let points = 0;
  for (const r of rows) {
    if (r.tier in coins) coins[r.tier] = r.c;
    points += r.p;
  }
  return { coins, points };
}

// "gold,gold,bronze" (from GROUP_CONCAT) -> { gold: 2, bronze: 1, ... }
function countTiers(list) {
  const coins = emptyCoins();
  for (const t of String(list || '').split(',')) if (t in coins) coins[t]++;
  return coins;
}

module.exports = { TIERS, coinSummary, countTiers };
