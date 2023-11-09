import * as path from "node:path";
import * as fsp from "node:fs/promises";
import * as readline from "node:readline/promises";
import sharp from "sharp";
import {loadJSON, isString} from "./utils.js";
import Logger from "./logger.js";

const max_image_size = 1800;
let logger = null;

const readOne = async (prompt) => {
  const rl = readline.createInterface({
    "input": process.stdin,
    "output": process.stdout
  });
  const answer = await rl.question(prompt);
  const text = answer.trim();
  rl.close();
  return text === "" ? null : text;
};

const readMulti = async (prompt) => {
  const results = [];
  const rl = readline.createInterface({
    "input": process.stdin,
    "output": process.stdout
  });
  while (true) {
    const answer = await rl.question(prompt);
    const text = answer.trim();
    if (text !== "") {
      results.push(text);
    } else {
      rl.close();
      break;
    }
  }
  return results;
};

const parseDateOrNow = (str) => {
  const date = new Date(str);
  return isNaN(date.valueOf()) ? Date.now() : date.getTime();
};

const makeDirName = (created, subDirs) => {
  // Use timestamp as ID and dir name.
  let baseName = `${created}`;
  // Timestamps may start with `-`, replace it with `n` because dir starts
  // with `-` is hard to handle for shell commands.
  // Is there anyone using it in 1969?
  if (baseName.charAt(0) === "-") {
    baseName = `n${baseName.substring(1)}`;
  }
  let dirName = baseName;
  let i = 0;
  // If conflict, find a new name. Very little chance.
  while (subDirs.includes(dirName)) {
    dirName = `${baseName}-${++i}`;
  }
  return dirName;
};

const compressJPG = async (src, dst) => {
  const image = sharp(src);
  let {width, height, orientation} = await image.metadata();
  // See <https://dataloop.ai/docs/exif-orientation-value> for `5` here.
  if ((orientation || 0) >= 5) {
    [width, height] = [height, width];
  }
  // Limit the longest edge to `max_image_size`. Like what Telegram does.
  if (width > height) {
    height = Math.round(height * max_image_size / width);
    width = max_image_size;
  } else {
    width = Math.round(width * max_image_size / height);
    height = max_image_size;
  }
  return image
    // Rotate it as orientation in metadata before metadata gets cleared.
    .rotate()
    // Must resize after rotate, otherwise it works like filling image on a
    // fixed canvas, leads into cropping.
    .resize(width, height)
    .jpeg({"mozjpeg": true})
    .toFile(dst);
};

const writeAlbum = async (album, galleryPath, opts = {}) => {
  let subDirs;
  try {
    subDirs = await fsp.readdir(galleryPath);
  } catch (error) {
    logger.error(error);
    subDirs = [];
  }
  const dirName = makeDirName(album["date"], subDirs);
  const albumPath = path.join(galleryPath, dirName);
  logger.debug(`Creating album ${logger.cyan(albumPath)}`);
  try {
    await fsp.mkdir(albumPath);
    const fileNames = await Promise.all(album["images"].map(async (src, i) => {
      // Add dir name as prefix so downloading different albums won't conflict.
      const fileName = `${dirName}-${i + 1}.jpg`;
      const filePath = path.join(albumPath, fileName);
      if (opts["compress"]) {
        logger.debug(`Writing compressed version of ${logger.cyan(src)} to ${logger.cyan(filePath)}...`);
        await compressJPG(src, filePath);
      } else {
	logger.debug(`Copying ${logger.cyan(src)} to ${logger.cyan(filePath)}...`);
        await fsp.copyFile(src, filePath);
      }
      return fileName;
    }));
    const metadata = {
      "dir": dirName,
      "created": album["date"],
      "layout": "album",
      "text": album["text"],
      "images": fileNames,
      "authors": null,
      "tags": null
    };
    const metadataPath = path.join(albumPath, "index.json");
    logger.debug(`Writing album metadata to ${logger.cyan(metadataPath)}...`);
    await fsp.writeFile(
      metadataPath,
      JSON.stringify(metadata),
      "utf8"
    );
  } catch (error) {
    logger.error(error);
    // Try not to mess things up if failed.
    await fsp.rm(albumPath, {"recursive": true, "force": true});
  }
};

const create = async (dir, opts) => {
  logger = new Logger({"debug": opts["debug"], "color": opts["color"]});
  const configPath = opts["config"] || path.join(dir, "config.json");
  let config = null;
  try {
    config = await loadJSON(configPath);
  } catch (error) {
    logger.error(error);
    return;
  }
  const {docDir, galleryDir} = config;

  const album = {
    "text": null,
    "images": [],
    "date": null
  };

  if (opts["text"] != null) {
    album["text"] = opts["text"].join("");
  } else {
    album["text"] = await readOne("Please attach text here (enter empty answer to skip): ");
  }

  if (opts["image"] != null) {
    album["images"] = opts["image"];
  } else {
    album["images"] = await readMulti("Please attach image here (enter empty answer to finish): ");
  }

  if (opts["date"] === true) {
    album["date"] = Date.now();
  } else if (isString(opts["date"])) {
    album["date"] = parseDateOrNow(opts["date"].trim());
  } else {
    const str = await readOne("Please set created date here (enter empty answer to use current): ");
    album["date"] = str == null ? Date.now() : parseDateOrNow(str);
  }

  if (album["images"].length == 0 && album["text"] == null) {
    logger.debug("Empty album, exiting...");
    return;
  }

  const galleryPath = path.join(dir, docDir, galleryDir);
  await writeAlbum(album, galleryPath, {"compress": opts["compress"]});
};

export default create;
