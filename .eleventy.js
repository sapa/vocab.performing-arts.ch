//npm install jsonld
const jsonld = require("jsonld");
// npm install rdf-parse
const rdfParser = require("rdf-parse").default;
// npm install rdf-serialize
const rdfSerializer = require("rdf-serialize").default;
// npm install @11ty/eleventy-fetch
const { AssetCache } = require("@11ty/eleventy-fetch");
const nunjucks = require("nunjucks");
const EleventyBaseError = require("@11ty/eleventy/src/EleventyBaseError");

// Interface web QLever : ?exec=true exécute la requête à l’ouverture de la page.
const QLEVER_UI = "https://qlever-ui.performing-arts.ch/";

AssetCache.concurrency = 4;

module.exports = function (eleventyConfig) {
  eleventyConfig.setNunjucksEnvironmentOptions({
    throwOnUndefined: true,
    autoescape: false, // warning: don’t do this!
  });

  /**
   * expands the prefixed URI to a complete URI based on the input JSON-LD context
   * Usage : {{ jsonScheme | expandURI(vocabulary.id) }}
   **/
  eleventyConfig.addFilter("expandURI", async function (inputContext, concept) {
    const inputPrefix = concept.split(":")[0];
    const inputConcept = concept.split(":")[1];

    const obj = JSON.parse(inputContext);
    return obj[inputPrefix] + inputConcept;
  });

  /**
   * Returns a label in the given language from a label array
   * Usage : {{ item.prefLabel | languageIn('en') }}
   **/
  eleventyConfig.addFilter("languageIn", function (arr, locale) {
    result = "";
    for (let index = 0; index < arr.length; index++) {
      const element = arr[index];
      if (element["@language"] === locale) {
        result = element["@value"];
      }
    }
    const output_Label = result === "" ? arr["@value"] : result;
    return output_Label;
  });

  /**
   * Returns a label not in the given language from a label array
   * Usage : {{ item.prefLabel | languageNotIn('en') }}
   **/
  eleventyConfig.addFilter("languageNotIn", function (arr, locale) {
    result = [];
    for (let index = 0; index < arr.length; index++) {
      const element = arr[index];
      if (element["@language"] !== locale) {
        result.push(element);
      }
    }
    return result;
  });

  /**
   * Sorts the array by the id of the items
   **/
  eleventyConfig.addFilter("sortById", function (jsonData) {
    let compareById = function (a, b) {
      if (a.id < b.id) {
        return -1;
      }
      if (a.id > b.id) {
        return 1;
      }
      return 0;
    };
    return jsonData.sort(compareById);
  });

  /**
   * https://stackoverflow.com/questions/46426306/how-to-safely-render-json-into-an-inline-script-using-nunjucks
   * Returns a JSON stringified version of the value, safe for inclusion in an
   * inline <script> tag. The optional argument 'spaces' can be used for
   * pretty-printing.
   *
   * Output is NOT safe for inclusion in HTML! If that's what you need, use the
   * built-in 'dump' filter instead.
   */
  eleventyConfig.addFilter("json", function (value) {
    if (value instanceof nunjucks.runtime.SafeString) {
      value = value.toString();
    }
    const spaces = null;
    //const jsonString = JSON.stringify(value, null, spaces).replace(/</g, '\\u003c')
    const jsonString = JSON.stringify(value);
    return new nunjucks.runtime.markSafe(jsonString);
  });

  /**
   * Removes the prefix from the id
   **/
  eleventyConfig.addFilter("removePrefix", function (value) {
    return value.split(":")[1];
  });

  /**
   * Turns an absolute URL into one relative to the current page.
   * Usage : {{ "/downloads/ac.ttl" | relative(page) }}
   **/
  eleventyConfig.addFilter("relative", function (absoluteUrl, page) {
    if (absoluteUrl.includes("://")) {
      // full URI, return it directly
      return absoluteUrl;
    }
    try {
      var relativeUrl = require("path").relative(page.url, absoluteUrl);
      const URLRelative = relativeUrl.replace(new RegExp(/\\/g), "/");
      return URLRelative;
    } catch (error) {
      return absoluteUrl;
    }
  });

  // skos:exactMatch
  eleventyConfig.addShortcode("getexactMatch", async function (jsonData) {
    var outputTag = "";
    if (jsonData.length > 0) {
      var obj = JSON.parse(jsonData);
      var tag = "";
      // if json data is a String
      if (typeof obj === "string") {
        tag += `<li>${obj}</li>`;
      } else {
        // if json data is an object
        var nCountSource = obj.length;
        if (nCountSource > 0) {
          for (const s of obj) {
            if (typeof s === "string") {
              tag += `<li>${s}</li>`;
            } else {
              nCountData = s.length;
              if (nCountData > 0) {
                for (let index = 0; index < s.length; index++) {
                  const element = s[index];
                  tag += `<li><a href="${element.id}">${element.id}</a></li>`;
                }
              } else {
                tag += `<li><a href="${s.id}">${s.id}</a></li>`;
              }
            }
          }
        } else {
          tag += `<li><a href="${obj.id}">${obj.id}</a></li>`;
        }
      }

      outputTag = `<div class="row">
        <div class="col-1">
          <h6>Alignments</h6>
        </div>
        <div class="col">  
          <ul>  
          ${tag}
          </ul>
        </div>
      </div>`;
    }

    return outputTag;
  });

  /**
   * Returns the SPARQL query corresponding to the given concept ID
   **/
  eleventyConfig.addFilter("getSparql", function (conceptId) {
    const conceptCode = conceptId.split(":")[1];
    var urlSparql =
      QLEVER_UI +
      `?exec=true&query=PREFIX+spav%3A+%3Chttp%3A%2F%2Fvocab.performing-arts.ch%2F%3E%0ASELECT+%3Fentity%0AWHERE+%7B%0A++%3Fentity+%3Fattribute+spav%3A${conceptCode}+.%0A++FILTER%28%21STRSTARTS%28STR%28%3Fentity%29%2C%22http%3A%2F%2Fvocab.performing-arts.ch%22%29%29%0A%7D%0ALIMIT+1000`;
    return urlSparql;
  });

  /**
   * Returns the SPARQL query counting the usage of a whole vocabulary,
   * broken down by type of referencing entity and by property.
   * Contrairement à la requête "per Concept" (stats.queryUrl, produite par
   * scripts/read.js parce qu’elle alimente le camembert), celle-ci n’est jamais
   * exécutée au build : elle ne dépend que de l’URI du ConceptScheme.
   * Usage : {{ jsonScheme | getSparqlByTypeAndProperty(vocabulary.id) }}
   **/
  eleventyConfig.addFilter(
    "getSparqlByTypeAndProperty",
    function (inputContext, concept) {
      const inputPrefix = concept.split(":")[0];
      const inputConcept = concept.split(":")[1];
      const csUri = JSON.parse(inputContext)[inputPrefix] + inputConcept;

      const query = `PREFIX rico: <https://www.ica.org/standards/RiC/ontology#>
PREFIX frbroo: <http://iflastandards.info/ns/fr/frbr/frbroo/>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT ?type ?p (COUNT(?x) AS ?count)
WHERE {
  ?concept skos:inScheme <${csUri}> .
  ?x ?p ?concept . FILTER(!STRSTARTS(STR(?p), "http://www.w3.org/2004/02/skos/core#"))
  ?x a ?type .
}
GROUP BY ?type ?p`;

      return `${QLEVER_UI}?exec=true&query=${encodeURIComponent(query)}`;
    },
  );

  // pass-through
  eleventyConfig.addPassthroughCopy({ static: "/" });

  return {
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
    },
  };
};
