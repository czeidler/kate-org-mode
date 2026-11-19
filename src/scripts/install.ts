import fs from "fs";
import path from "path";
import os from "os";

const sourceFile = path.join("build", "OrgMode.xml");
const destFile = path.join(
  os.homedir(),
  ".local",
  "share",
  "ktexteditor_snippets",
  "data",
  "OrgMode.xml",
);

try {
  fs.copyFileSync(sourceFile, destFile);
  console.log(`> Successfully copied to ${destFile}`);
} catch (err) {
  console.error("> Error copying file:", err);
  process.exit(1);
}
