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

const getPathFn = (rootDir = path.posix.sep) => {
  // Anyway, we need to escape backslash literally using RegExp.
  const winSepRegExp = new RegExp(`\\${path.win32.sep}`, "g");
  rootDir = rootDir.replace(winSepRegExp, path.posix.sep);
  if (!rootDir.endsWith(path.posix.sep)) {
    rootDir = path.posix.join(rootDir, path.posix.sep);
  }
  if (!path.posix.isAbsolute(rootDir)) {
    rootDir = path.posix.join(path.posix.sep, rootDir);
  }
  return (docPath = "", skipEncode = false) => {
    // Handle link with query string or hash.
    // Use assertion to prevent `?` and `#` to be removed.
    const array = docPath.split(/(?=[?#])/);
    array[0] = array[0].replace(winSepRegExp, path.posix.sep);
    const baseName = path.posix.basename(array[0]);
    const dirName = path.posix.dirname(array[0]);
    if (baseName === "index.html" || baseName === "index.htm") {
      array[0] = path.posix.join(dirName, path.posix.sep);
    }
    /**
     * marked.js and CommonMark tends to do URL encode by themselevs.
     * Maybe I should not do `encodeURL()` here.
     * See <https://github.com/markedjs/marked/issues/1285>.
     */
    return skipEncode
      ? path.posix.join(rootDir, ...array)
      : encodeURI(path.posix.join(rootDir, ...array));
  };
};

const getURLFn = (baseURL, rootDir = path.posix.sep) => {
  const getPath = getPathFn(rootDir);
  return (docPath = "") => {
    return new URL(getPath(docPath), baseURL);
  };
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
  getPathFn,
  getURLFn,
  getVersion
};
