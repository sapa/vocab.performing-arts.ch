const fs = require("fs/promises");
const path = require("path");
const https = require("https");
const jsonld = require("jsonld");

// Configuration
const ENDPOINT = "https://www.performing-arts.ch/sparql";
const GRAPH = "http://vocab.performing-arts.ch/container/context";

const TTL_OUTPUT = path.join(__dirname, "../src/_data/vocabulary.ttl");
const DOWNLOADS_DIR = path.join(__dirname, "../static/downloads");
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

// Helper HTTP : interroge le endpoint SPARQL et renvoie le corps brut (string)

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

// Étape 3 (pour un CS) : écrit <notation>.ttl / .jsonld
async function fetchSchemeFiles(scheme, context) {
  const { uri, notation } = scheme;
  const query = querySchemeContent(uri);

  // TTL : servi directement par le endpoint.
  const [turtle, rawJsonld] = await Promise.all([
    sparql(query, "text/turtle"),
    sparql(query, "application/ld+json"),
  ]);

  // JSON-LD : compacté avec un @context SKOS lisible.
  const compacted = await jsonld.compact(JSON.parse(rawJsonld), context);
  const jsonldOut = JSON.stringify(compacted, null, 2);

  await Promise.all([
    fs.writeFile(path.join(DOWNLOADS_DIR, `${notation}.ttl`), turtle, "utf8"),
    fs.writeFile(
      path.join(DOWNLOADS_DIR, `${notation}.jsonld`),
      jsonldOut,
      "utf8",
    ),
  ]);

  console.log(`   - ${notation} (ttl/jsonld)`);
}

// Traite tous les CS par lots de CONCURRENCY.
async function fetchAllSchemeFiles(schemes, context) {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
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
