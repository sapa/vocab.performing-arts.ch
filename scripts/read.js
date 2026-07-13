const fs = require("fs/promises");
const path = require("path");
const https = require("https");
const jsonld = require("jsonld");

// Configuration
const ENDPOINT = "https://www.performing-arts.ch/sparql";
const GRAPH = "http://vocab.performing-arts.ch/container/context";

// Endpoint QLever
const QLEVER_API = "https://qlever.performing-arts.ch/";
// Interface web QLever, pour les liens cliquables montrés à l'utilisateur.
const QLEVER_UI = "https://qlever-ui.performing-arts.ch/";
// Préfixe des concepts, pour construire les liens "Usage" par concept.
const VOCAB_PREFIX = "http://vocab.performing-arts.ch/";

const TTL_OUTPUT = path.join(__dirname, "../src/_data/vocabulary.ttl");
const DOWNLOADS_DIR = path.join(__dirname, "../static/downloads");
const STATS_DIR = path.join(__dirname, "../static/stats");
const DOWNLOAD_CONTEXT_PATH = path.join(__dirname, "./download-context.json");

// Nombre de ConceptSchemes traités en parallèle pour ne pas surcharger le endpoint
const CONCURRENCY = 8;

// Requêtes SPARQL

const QUERY_CONSTRUCT_ALL = `
CONSTRUCT { ?s ?p ?o }
WHERE {
  GRAPH <${GRAPH}> { ?s ?p ?o }
}`;

const QUERY_LIST_SCHEMES = `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?cs ?notation
WHERE {
  GRAPH <${GRAPH}> {
    ?cs a skos:ConceptScheme ;
        skos:notation ?notation .
  }
}
ORDER BY ?notation`;

// Récupère le ConceptScheme + tous les concepts qui lui appartiennent (skos:inScheme).
const querySchemeContent = (csUri) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
CONSTRUCT {
  ?cs ?csp ?cso .
  ?c ?cp ?co .
}
WHERE {
  GRAPH <${GRAPH}> {
    VALUES ?cs { <${csUri}> }
    ?cs ?csp ?cso .
    OPTIONAL { ?c skos:inScheme ?cs ; ?cp ?co . }
  }
}`;

// Export CSV : une ligne par concept. Les valeurs multiples sont agrégées avec
// MULTI_SEP côté SPARQL, puis re-jointes par ";" dans le CSV (cf. buildCsv).
const MULTI_SEP = "||";
const querySchemeCsv = (csUri) => `
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX ric: <https://www.ica.org/standards/RiC/ontology#>
SELECT ?concept ?notation ?broader
  (SAMPLE(?broaderNotation) AS ?broader_notation)
  (GROUP_CONCAT(DISTINCT ?prefEn; separator="${MULTI_SEP}") AS ?prefLabel_en)
  (GROUP_CONCAT(DISTINCT ?prefFr; separator="${MULTI_SEP}") AS ?prefLabel_fr)
  (GROUP_CONCAT(DISTINCT ?prefDe; separator="${MULTI_SEP}") AS ?prefLabel_de)
  (GROUP_CONCAT(DISTINCT ?prefIt; separator="${MULTI_SEP}") AS ?prefLabel_it)
  (GROUP_CONCAT(DISTINCT ?altEn; separator="${MULTI_SEP}") AS ?altLabel_en)
  (GROUP_CONCAT(DISTINCT ?altFr; separator="${MULTI_SEP}") AS ?altLabel_fr)
  (GROUP_CONCAT(DISTINCT ?altDe; separator="${MULTI_SEP}") AS ?altLabel_de)
  (GROUP_CONCAT(DISTINCT ?altIt; separator="${MULTI_SEP}") AS ?altLabel_it)
  (GROUP_CONCAT(DISTINCT ?hidden; separator="${MULTI_SEP}") AS ?hiddenLabel)
  (GROUP_CONCAT(DISTINCT ?ricEn; separator="${MULTI_SEP}") AS ?ricName_en)
  (GROUP_CONCAT(DISTINCT ?ricFr; separator="${MULTI_SEP}") AS ?ricName_fr)
  (GROUP_CONCAT(DISTINCT ?ricDe; separator="${MULTI_SEP}") AS ?ricName_de)
  (GROUP_CONCAT(DISTINCT ?ricIt; separator="${MULTI_SEP}") AS ?ricName_it)
  (GROUP_CONCAT(DISTINCT ?defEn; separator="${MULTI_SEP}") AS ?definition_en)
  (GROUP_CONCAT(DISTINCT ?edNote; separator="${MULTI_SEP}") AS ?editorialNote_en)
  (GROUP_CONCAT(DISTINCT REPLACE(STR(?narrower), "^.*[#/]", ""); separator="${MULTI_SEP}") AS ?narrower)
  (GROUP_CONCAT(DISTINCT ?match; separator="${MULTI_SEP}") AS ?exactMatch)
WHERE {
  GRAPH <${GRAPH}> {
    ?concept a skos:Concept ; skos:inScheme <${csUri}> .
    OPTIONAL { ?concept skos:notation ?notation }
    OPTIONAL {
      ?concept skos:broader ?broader .
      OPTIONAL { ?broader skos:notation ?broaderNotation }
    }
    OPTIONAL { ?concept skos:prefLabel ?prefEn . FILTER(LANG(?prefEn)="en") }
    OPTIONAL { ?concept skos:prefLabel ?prefFr . FILTER(LANG(?prefFr)="fr") }
    OPTIONAL { ?concept skos:prefLabel ?prefDe . FILTER(LANG(?prefDe)="de") }
    OPTIONAL { ?concept skos:prefLabel ?prefIt . FILTER(LANG(?prefIt)="it") }
    OPTIONAL { ?concept skos:altLabel ?altEn . FILTER(LANG(?altEn)="en") }
    OPTIONAL { ?concept skos:altLabel ?altFr . FILTER(LANG(?altFr)="fr") }
    OPTIONAL { ?concept skos:altLabel ?altDe . FILTER(LANG(?altDe)="de") }
    OPTIONAL { ?concept skos:altLabel ?altIt . FILTER(LANG(?altIt)="it") }
    OPTIONAL { ?concept skos:hiddenLabel ?hidden }
    OPTIONAL { ?concept ric:name ?ricEn . FILTER(LANG(?ricEn)="en") }
    OPTIONAL { ?concept ric:name ?ricFr . FILTER(LANG(?ricFr)="fr") }
    OPTIONAL { ?concept ric:name ?ricDe . FILTER(LANG(?ricDe)="de") }
    OPTIONAL { ?concept ric:name ?ricIt . FILTER(LANG(?ricIt)="it") }
    OPTIONAL { ?concept skos:definition ?defEn . FILTER(LANG(?defEn)="en") }
    OPTIONAL { ?concept skos:editorialNote ?edNote . FILTER(LANG(?edNote)="en") }
    OPTIONAL { ?concept skos:narrower ?narrower }
    OPTIONAL { ?concept skos:exactMatch ?match }
  }
}
GROUP BY ?concept ?notation ?broader
ORDER BY ?notation`;

// Colonnes du CSV, dans l'ordre. "path_en" est calculé en JS (cf. buildCsv).
const CSV_COLUMNS = [
  "uri",
  "notation",
  "prefLabel_en",
  "prefLabel_fr",
  "prefLabel_de",
  "prefLabel_it",
  "altLabel_en",
  "altLabel_fr",
  "altLabel_de",
  "altLabel_it",
  "hiddenLabel",
  "ricName_en",
  "ricName_fr",
  "ricName_de",
  "ricName_it",
  "definition_en",
  "editorialNote_en",
  "broader_notation",
  "path_en",
  "narrower",
  "exactMatch",
];

// Statistiques d'usage (camemberts) — nombre d'entités de la plateforme
// référençant chaque concept. Le FILTER exclut les sujets internes au vocab.
const queryUsageStats = (
  csUri,
) => `PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?concept ?label (COUNT(?entity) AS ?count)
WHERE {
  ?concept a skos:Concept .
  ?concept skos:inScheme <${csUri}> .
  ?concept skos:prefLabel ?label .
  FILTER(lang(?label) = "en")
  ?entity ?p ?concept .
  FILTER(!STRSTARTS(STR(?entity), "${VOCAB_PREFIX}"))
}
GROUP BY ?concept ?label
ORDER BY DESC(?count)`;

// Requête "Usage" d'UN concept, pour le lien cliquable de chaque part de camembert.
const queryConceptUsage = (code) => `PREFIX spav: <${VOCAB_PREFIX}>
SELECT ?entity
WHERE {
  ?entity ?attribute spav:${code} .
  FILTER(!STRSTARTS(STR(?entity),"${VOCAB_PREFIX.replace(/\/$/, "")}"))
}
LIMIT 1000`;

// Construit un lien vers l'interface web QLever pour une requête donnée.
const qleverUiLink = (query) =>
  `${QLEVER_UI}?query=${encodeURIComponent(query)}`;

// Interroge le endpoint SPARQL, renvoie le corps brut (string).
function sparql(query, acceptMime) {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: acceptMime } }, (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(
                `HTTP ${res.statusCode} pour Accept:${acceptMime}\n${data.slice(0, 500)}`,
              ),
            );
            return;
          }
          resolve(data);
        });
      })
      .on("error", reject);
  });
}

// Interroge QLever (POST), renvoie le JSON de résultats parsé.
function qlever(query) {
  const body = `query=${encodeURIComponent(query)}`;
  const u = new URL(QLEVER_API);
  const options = {
    hostname: u.hostname,
    path: u.pathname + u.search,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
      "Content-Length": Buffer.byteLength(body),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(
            new Error(`QLever HTTP ${res.statusCode}\n${data.slice(0, 500)}`),
          );
          return;
        }
        resolve(JSON.parse(data));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Helpers CSV

// Échappe une valeur selon RFC 4180.
function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Réponse SPARQL JSON -> tableau d'objets { var: "valeur" }.
function bindingsToRows(sparqlJson) {
  return sparqlJson.results.bindings.map((b) => {
    const row = {};
    for (const v of sparqlJson.head.vars) {
      row[v] = b[v] ? b[v].value : "";
    }
    return row;
  });
}

// Transforme une valeur agrégée "a||b||c" en "a;b;c" (séparateur CSV interne).
function joinMulti(value) {
  if (!value) return "";
  return value.split(MULTI_SEP).filter(Boolean).join(";");
}

// Construit le CSV d'un vocabulaire. Reconstruit "path_en" (chaîne des ancêtres
// EN, ex. "performance > narration") en remontant skos:broader.
function buildCsv(rows) {
  const byUri = new Map(rows.map((r) => [r.concept, r]));

  const labelEnOf = (uri) => {
    const r = byUri.get(uri);
    return r ? joinMulti(r.prefLabel_en).split(";")[0] : "";
  };

  // Remonte la chaîne des parents jusqu'à la racine ; garde-fou anti-cycle.
  const pathEn = (row) => {
    const chain = [];
    const seen = new Set();
    let current = row.broader;
    while (current && byUri.has(current) && !seen.has(current)) {
      seen.add(current);
      const label = labelEnOf(current);
      if (label) chain.unshift(label);
      current = byUri.get(current).broader;
    }
    return chain.join(" > ");
  };

  const lines = [CSV_COLUMNS.map(csvEscape).join(",")];
  for (const r of rows) {
    const record = {
      uri: r.concept,
      notation: r.notation,
      prefLabel_en: joinMulti(r.prefLabel_en),
      prefLabel_fr: joinMulti(r.prefLabel_fr),
      prefLabel_de: joinMulti(r.prefLabel_de),
      prefLabel_it: joinMulti(r.prefLabel_it),
      altLabel_en: joinMulti(r.altLabel_en),
      altLabel_fr: joinMulti(r.altLabel_fr),
      altLabel_de: joinMulti(r.altLabel_de),
      altLabel_it: joinMulti(r.altLabel_it),
      hiddenLabel: joinMulti(r.hiddenLabel),
      ricName_en: joinMulti(r.ricName_en),
      ricName_fr: joinMulti(r.ricName_fr),
      ricName_de: joinMulti(r.ricName_de),
      ricName_it: joinMulti(r.ricName_it),
      definition_en: joinMulti(r.definition_en),
      editorialNote_en: joinMulti(r.editorialNote_en),
      broader_notation: r.broader_notation,
      path_en: pathEn(r),
      narrower: joinMulti(r.narrower),
      exactMatch: joinMulti(r.exactMatch),
    };
    lines.push(CSV_COLUMNS.map((c) => csvEscape(record[c])).join(","));
  }
  // BOM UTF-8 pour un affichage correct des accents dans Excel.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

// Helpers stats (camemberts)

// Résultats QLever d'usage -> structure destinée à static/stats/<n>.json :
// { title, queryUrl, tree: [{ code, label, count, usageUrl }] }.
// Une entrée par concept utilisé (usage direct, sans hiérarchie).
function buildStats(sparqlJson, csUri) {
  const codeOf = (uri) => uri.replace(VOCAB_PREFIX, "");

  const tree = sparqlJson.results.bindings.map((b) => {
    const code = codeOf(b.concept.value);
    return {
      code,
      label: b.label.value,
      count: parseInt(b.count.value, 10) || 0,
      usageUrl: qleverUiLink(queryConceptUsage(code)),
    };
  });

  return {
    title: "Usage on performing-arts",
    queryUrl: qleverUiLink(queryUsageStats(csUri)),
    tree,
  };
}

// Étapes

// Étape 1 : dump global du graphe -> vocabulary.ttl
async function fetchAll() {
  const turtle = await sparql(QUERY_CONSTRUCT_ALL, "text/turtle");
  await fs.writeFile(TTL_OUTPUT, turtle, "utf8");
  console.log(`Étape 1 : vocabulary.ttl écrit (${turtle.length} octets)`);
}

// Étape 2 : liste des ConceptSchemes
async function listSchemes() {
  const raw = await sparql(
    QUERY_LIST_SCHEMES,
    "application/sparql-results+json",
  );
  const json = JSON.parse(raw);
  const schemes = json.results.bindings.map((b) => ({
    uri: b.cs.value,
    notation: b.notation.value,
  }));
  console.log(`Étape 2 : ${schemes.length} ConceptSchemes listés`);
  return schemes;
}

// Étape 3 (pour un CS) : écrit <notation>.ttl / .jsonld / .csv + stats/<n>.json
async function fetchSchemeFiles(scheme, context) {
  const { uri, notation } = scheme;
  const query = querySchemeContent(uri);

  // TTL / JSON-LD : servis directement par le endpoint.
  // CSV : export tabulaire dérivé d'un SELECT dédié (une ligne par concept).
  // Stats : usage réel interrogé sur QLever (endpoint séparé).
  const [turtle, rawJsonld, rawCsvJson, usageJson] = await Promise.all([
    sparql(query, "text/turtle"),
    sparql(query, "application/ld+json"),
    sparql(querySchemeCsv(uri), "application/sparql-results+json"),
    qlever(queryUsageStats(uri)).catch((err) => {
      // Un vocab sans données ne doit pas faire échouer tout le build.
      console.warn(`   ! stats indisponibles pour ${notation}: ${err.message}`);
      return { results: { bindings: [] } };
    }),
  ]);

  // JSON-LD : compacté avec un @context SKOS lisible.
  const compacted = await jsonld.compact(JSON.parse(rawJsonld), context);
  const jsonldOut = JSON.stringify(compacted, null, 2);

  // CSV : bindings SPARQL -> lignes -> texte CSV.
  const csvOut = buildCsv(bindingsToRows(JSON.parse(rawCsvJson)));

  // Stats : résultats QLever -> structure de camemberts.
  const stats = buildStats(usageJson, uri);
  const statsOut = JSON.stringify(stats, null, 2);

  await Promise.all([
    fs.writeFile(path.join(DOWNLOADS_DIR, `${notation}.ttl`), turtle, "utf8"),
    fs.writeFile(
      path.join(DOWNLOADS_DIR, `${notation}.jsonld`),
      jsonldOut,
      "utf8",
    ),
    fs.writeFile(path.join(DOWNLOADS_DIR, `${notation}.csv`), csvOut, "utf8"),
    fs.writeFile(path.join(STATS_DIR, `${notation}.json`), statsOut, "utf8"),
  ]);

  console.log(`   - ${notation} (ttl/jsonld/csv, ${stats.tree.length} usages)`);
}

// Traite tous les CS par lots de CONCURRENCY.
async function fetchAllSchemeFiles(schemes, context) {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
  await fs.mkdir(STATS_DIR, { recursive: true });
  for (let i = 0; i < schemes.length; i += CONCURRENCY) {
    const batch = schemes.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((s) => fetchSchemeFiles(s, context)));
  }
  console.log(
    `Étape 3 : ${schemes.length} vocabulaires téléchargeables générés`,
  );
}

// Main

(async () => {
  try {
    const context = JSON.parse(
      await fs.readFile(DOWNLOAD_CONTEXT_PATH, "utf8"),
    );

    await fetchAll();
    const schemes = await listSchemes();
    await fetchAllSchemeFiles(schemes, context);

    console.log("Terminé. Lance `npm run build` pour générer le site.");
  } catch (err) {
    console.error("Erreur :", err);
    process.exit(1);
  }
})();
