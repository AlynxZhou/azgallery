import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as readline from "node:readline/promises";
import sharp from "sharp";

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

  // Limit the longest edge to 1280. That's what Telegram does.
  if (width > height) {
    height = Math.round(height * 1280 / width);
    width = 1280;
  } else {
    width = Math.round(width * 1280 / height);
    height = 1280;
  }

  return image.resize(width, height).jpeg({"mozjpeg": true}).toFile(dst);
};

const writeAlbum = async (album, galleryPath, opts = {}) => {
  let subDirs;
  try {
    subDirs = await fs.readdir(galleryPath);
  } catch (error) {
    console.error(error);
    subDirs = [];
  }
  const dirName = makeDirName(album["date"], subDirs);
  const albumPath = path.join(galleryPath, dirName);
  try {
    await fs.mkdir(albumPath);
    const fileNames = await Promise.all(album["images"].map(async (src, i) => {
      const fileName = `${i + 1}.jpg`;
      const filePath = path.join(albumPath, fileName);
      if (opts["compress"]) {
        await compressJPG(src, filePath);
      } else {
        await fs.copyFile(src, filePath);
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
    await fs.writeFile(
      path.join(albumPath, "index.json"),
      JSON.stringify(metadata),
      "utf8"
    );
  } catch (error) {
    console.error(error);
    await fs.rm(albumPath, {"recursive": true, "force": true});
  }
};

const create = async (dir, opts) => {
  const configPath = opts["config"] || path.join(dir, "config.json");
  let config;
  try {
    const content = await fs.readFile(configPath, "utf8");
    config = JSON.parse(content);
  } catch (error) {
    console.error(error);
    return;
  }
  const {docDir, galleryDir} = config;

  const album = {
    "text": null,
    "images": [],
    "date": null
  };

  if (opts["text"].length > 0) {
    album["text"] = opts["text"].join("");
  } else {
    album["text"] = await readOne("Please attach text here: ");
  }

  if (opts["image"].length > 0) {
    album["images"] = opts["image"];
  } else {
    album["images"] = await readMulti("Please attach image here (enter empty answer to finish): ");
  }

  if (opts["date"] === true) {
    album["date"] = Date.now();
  } else if (typeof opts["date"] === "string") {
    album["date"] = parseDateOrNow(opts["date"].trim());
  } else {
    const str = await readOne("Please set created date here: ");
    album["date"] = str == null ? Date.now() : parseDateOrNow(str);
  }

  if (album["images"].length == 0 && album["text"] == null) {
    return;
  }

  const galleryPath = path.join(dir, docDir, galleryDir);
  await writeAlbum(album, galleryPath);
};

export default create;
