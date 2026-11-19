import fs from "node:fs";

const template = fs
  .readFileSync("./src/OrgModel.template.xml")
  .toString("utf8");
const script = fs
  .readFileSync("./out/org-mode.js")
  .toString("utf8")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");
const output = template.replace("{{SCRIPT}}", script);

fs.mkdirSync("./build", { recursive: true });
fs.writeFileSync("./build/OrgMode.xml", output);
