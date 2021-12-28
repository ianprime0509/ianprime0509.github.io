import fs from "fs/promises";
import process from "process";

const lightTheme = await fs.readFile(process.argv[2], {
  encoding: "utf-8",
});
const darkTheme = await fs.readFile(process.argv[3], {
  encoding: "utf-8",
});

const themeCss = `${lightTheme.trim()}

@media (prefers-color-scheme: dark) {
  ${darkTheme.trim().replace(/\n/g, "\n  ")}
}
`;

await fs.writeFile(process.argv[4], themeCss, { encoding: "utf-8" });
