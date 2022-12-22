const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const jsx = require("eleventy-plugin-static-jsx");

module.exports = (eleventyConfig) => {
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(jsx);

  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("favicon.png");
  eleventyConfig.addPassthroughCopy("favicon.svg");
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("posts/**/img/*");
  eleventyConfig.addPassthroughCopy("projects/**/img/*");

  eleventyConfig.addFilter("isoDate", (date) =>
    date.toISOString().substring(0, 10)
  );
  eleventyConfig.addFilter("lastN", (items, n) => items.slice(-n));
};
