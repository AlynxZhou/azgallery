import * as path from "node:path";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";

const pkgDir = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../"
);

const loadJSON = async (path) => {
  return JSON.parse(await fsp.readFile(path, "utf8"));
};

const loadJSONSync = (path) => {
  return JSON.parse(fs.readFileSync(path, "utf8"));
};

const pkgJSON = loadJSONSync(path.join(pkgDir, "package.json"));

const isString = (o) => {
  return typeof o === "string" || o instanceof String;
};

const isFunction = (o) => {
  return o instanceof Function;
};

const getVersion = () => {
  return pkgJSON["version"];
};

export {
  pkgDir,
  loadJSON,
  loadJSONSync,
  isString,
  isFunction,
  getVersion
};
