const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = (config) => {
  config.addPlugin(syntaxHighlight);

  config.addPassthroughCopy("css");
  config.addPassthroughCopy("posts/**/img/*");
  config.addPassthroughCopy("projects/**/img/*");

  config.addFilter("isoDate", (date) => date.toISOString().substring(0, 10));
  config.addFilter("lastN", (items, n) => items.slice(-n));
};
