#!/usr/bin/env node
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const args = process.argv.slice(2);

function usage() {
  console.error(`Usage:
  node scripts/publish-project.mjs --image /abs/photo1.jpg [--image /abs/photo2.jpg]
    [--name "Richmond Kitchen Installation"]
    [--location "Richmond, BC"]
    [--material "white prefab cabinets, stone countertop coordination"]
    [--audience "clean installation, practical storage"]
    [--style quiet|european|warm|french|japandi|urban]
    [--push]
`);
  process.exit(1);
}

function takeValue(flag, fallback = "") {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) usage();
  return value;
}

function takeAll(flag) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) usage();
      values.push(value);
      index += 1;
    }
  }
  return values;
}

function slugify(value) {
  return String(value || "project")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "project";
}

function runGit(argsList) {
  return execFileSync("git", argsList, { cwd: repoRoot, encoding: "utf8" }).trim();
}

const imagePaths = takeAll("--image").map((item) => resolve(item));
if (!imagePaths.length) usage();

const name = takeValue("--name", "Kitchen Cabinet Installation");
const location = takeValue("--location", "Vancouver, BC");
const material = takeValue("--material", "prefab cabinets, panel alignment, countertop coordination");
const audience = takeValue("--audience", "clean installation, practical storage, clear budget");
const styleId = takeValue("--style", "quiet");
const shouldPush = args.includes("--push");

const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const projectSlug = `${timestamp}-${slugify(name)}`;
const assetDir = resolve(repoRoot, "assets", "projects", projectSlug);
await mkdir(assetDir, { recursive: true });

const images = [];
for (const [index, sourcePath] of imagePaths.entries()) {
  const ext = extname(sourcePath).toLowerCase() || ".jpg";
  const fileName = `${String(index + 1).padStart(2, "0")}-${slugify(basename(sourcePath, ext))}${ext}`;
  const targetPath = resolve(assetDir, fileName);
  await copyFile(sourcePath, targetPath);
  images.push({
    name: basename(sourcePath),
    url: `./assets/projects/${projectSlug}/${fileName}`
  });
}

const data = {
  name,
  location,
  material,
  audience,
  styleId,
  images
};

const content = `window.CHENO_PUBLISHED_PROJECT = ${JSON.stringify(data, null, 2)};\n`;
await writeFile(resolve(repoRoot, "data", "project.js"), content, "utf8");

console.log(`Updated website project data with ${images.length} image(s).`);
console.log(`Project assets: assets/projects/${projectSlug}`);

if (shouldPush) {
  runGit(["add", "data/project.js", "assets/projects"]);
  const commitMessage = `Update Cheno project showcase: ${name}`;
  try {
    runGit(["commit", "-m", commitMessage]);
  } catch (error) {
    const output = String(error.stdout || error.stderr || error.message || "");
    if (!output.includes("nothing to commit")) throw error;
  }
  runGit(["push", "origin", "main"]);
  console.log("Pushed update to GitHub Pages.");
}
