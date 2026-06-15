const fs = require("fs");
const { AssetCache } = require("@11ty/eleventy-fetch");
AssetCache.concurrency = 4;

//const url = JSON.parse(fs.readFileSync("../_data/site.json"));

module.exports = async function () {
    /* code */
    console.log("test");


    return "test";
}