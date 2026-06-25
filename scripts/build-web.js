const { cp, mkdir, rm, copyFile } = require("node:fs/promises");
const { join } = require("node:path");

const root = join(__dirname, "..");
const outDir = join(root, "www");

const files = ["index.html", "styles.css", "script.js", "manifest.webmanifest"];
const folders = ["assets", "legal"];

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const file of files) {
    await copyFile(join(root, file), join(outDir, file));
  }

  for (const folder of folders) {
    await cp(join(root, folder), join(outDir, folder), { recursive: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
