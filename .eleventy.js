const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const jsx = require("eleventy-plugin-static-jsx");

module.exports = (config) => {
  config.addPlugin(syntaxHighlight);
  config.addPlugin(jsx);

  config.addPassthroughCopy("CNAME");
  config.addPassthroughCopy("favicon.png");
  config.addPassthroughCopy("favicon.svg");
  config.addPassthroughCopy("css");
  config.addPassthroughCopy("posts/**/img/*");
  config.addPassthroughCopy("projects/**/img/*");

  config.addFilter("isoDate", (date) => date.toISOString().substring(0, 10));
  config.addFilter("lastN", (items, n) => items.slice(-n));
};
