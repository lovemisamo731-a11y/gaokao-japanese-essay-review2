import { mkdir, copyFile, rm } from "node:fs/promises";

const outputDir = new URL("../dist/", import.meta.url);
const files = ["index.html", "styles.css", "script.js"];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await Promise.all(
  files.map((file) => copyFile(new URL(`../${file}`, import.meta.url), new URL(file, outputDir)))
);
