const fs = require("fs");
const path = require("path");

// Comptages d'usage produits par scripts/read.js (`npm run fetch`) : un fichier
// par vocabulaire dans static/stats/. On les aplatit en { code: count } pour
// afficher la ligne "Usage" de chaque concept (cf. src/vocabulary.njk).
// Les codes (cfdmg, asarm, ...) sont uniques d'un vocabulaire à l'autre.
const STATS_DIR = path.join(__dirname, "../../static/stats");

module.exports = function () {
  const counts = {};

  let files;
  try {
    files = fs.readdirSync(STATS_DIR).filter((f) => f.endsWith(".json"));
  } catch (err) {
    // Stats absentes (`npm run fetch` pas encore lancé) : les concepts seront
    // tous affichés comme non utilisés plutôt que de faire échouer le build.
    console.warn(`! stats d'usage introuvables dans ${STATS_DIR}`);
    return counts;
  }

  for (const file of files) {
    const stats = JSON.parse(
      fs.readFileSync(path.join(STATS_DIR, file), "utf8"),
    );
    for (const entry of stats.tree || []) {
      counts[entry.code] = entry.count;
    }
  }

  return counts;
};
