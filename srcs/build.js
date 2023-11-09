import * as path from "node:path";
import * as fsp from "node:fs/promises";
import {loadJSON, getVersion} from "./utils.js";
import Logger from "./logger.js";

let logger = null;

const readGalleryAlbums = async (docPath, galleryDir, rootDir = "/") => {
  const galleryPath = path.join(docPath, galleryDir);
  let subDirs;
  try {
    subDirs = await fsp.readdir(galleryPath);
  } catch (error) {
    logger.error(error);
    subDirs = [];
  }
  const strs = await Promise.all(subDirs.map((dir) => {
    return fsp.readFile(
      path.join(
	galleryPath, dir, "index.json"
      ),
      "utf8"
    );
  }));
  // Convert relative path to full path for URL.
  const albums = strs.map(JSON.parse).map((metadata) => {
    metadata["images"] = metadata["images"].map((image) => {
      return path.posix.join(rootDir, galleryDir, metadata["dir"], image);
    });
    return metadata;
  });
  // Newest first.
  albums.sort((a, b) => {
    return b["created"] - a["created"];
  });
  return albums;
};

const paginate = (albums, perPage) => {
  perPage = perPage || albums.length;
  const pages = [];
  let perPageAlbums = [];
  for (const album of albums) {
    if (perPageAlbums.length === perPage) {
      pages.push(perPageAlbums);
      perPageAlbums = [];
    }
    perPageAlbums.push(album);
  }
  pages.push(perPageAlbums);
  return pages;
};

const getPageFileName = (idx, basename = "index") => {
  return idx === 0 ? `${basename}.html` : `${basename}-${idx + 1}.html`;
};

const writePage = (cur, idx, arr, docPath, opts = {}) => {
  opts["rootDir"] = opts["rootDir"] || "/";
  const html = [];
  html.push(
    "<!DOCTYPE html>\n",
    "<html lang=\"zh-Hans\">\n",
    "  <head>\n",
    "    <meta charset=\"utf-8\">\n",
    "    <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=10\">\n",
    `    <link rel="stylesheet" type="text/css" href="${path.posix.join(opts["rootDir"], "css/normalize.css")}">\n`,
    `    <link rel="stylesheet" type="text/css" href="${path.posix.join(opts["rootDir"], "css/index.css")}">\n`,
    // `    <script type="text/javascript" src="${path.posix.join(config["rootDir"], "js/index.js")}"></script>\n`,
    `    <title>${opts["title"] || "gallery"}</title>\n`,
    "  </head>\n",
    "  <body>\n",
    "    <div class=\"container timeline\">\n",
    "      <header>\n"
  );
  if (opts["title"] != null) {
    html.push(
      `        <div class="title" id="title">${opts["title"]}</div>\n`
    );
  }
  if (opts["subtitle"] != null) {
    html.push(
      `        <div class="subtitle" id="subtitle">${opts["subtitle"]}</div>\n`
    );
  }
  html.push(
    "      </header>\n",
    "      <main>\n",
    "        <div class=\"gallery\" id=\"gallery\">\n",
  );
  const albums = cur;
  let lastYear = null;
  let lastMonth = null;
  let lastDay = null;
  const formatter = new Intl.DateTimeFormat("zh-Hans", {
    "year": "numeric",
    "month": "2-digit",
    "day": "2-digit",
    "weekday": "short",
    "hour": "2-digit",
    "minute": "2-digit",
    "second": "2-digit",
    "timeZoneName": "short",
    "hour12": false
  });
  for (const album of albums) {
    if (album["images"] == null && album["text"] == null) {
      continue;
    }
    const created = new Date(album["created"]);
    const parts = formatter.formatToParts(created);
    const obj = {};
    for (let {type, value} of parts) {
      obj[type] = value;
    }
    if (obj["year"] !== lastYear) {
      lastYear = obj["year"];
      html.push(
	`          <h1 class="gallery-date">${lastYear}</h1>\n`
      );
    }
    if (obj["month"] !== lastMonth || obj["day"] !== lastDay) {
      lastMonth = obj["month"];
      lastDay = obj["day"];
      html.push(
	`          <h2 class="gallery-date">${lastMonth}-${lastDay}</h2>\n`
      );
    }
    html.push(
      "          <div class=\"gallery-album\">\n",
      `            <h4 class="gallery-date">${obj["hour"]}:${obj["minute"]}:${obj["second"]}</h4>\n`
    );
    if (album["images"] != null) {
      html.push(
	"            <div class=\"gallery-album-images\">\n"
      );
      for (const image of album["images"]) {
	html.push(
	  "              <div class=\"gallery-album-image card\">\n",
	  `                <a class="image-link" target="_blank" href="${image}"><img src="${image}"></a>\n`,
	  "              </div>\n"
	);
      }
      html.push(
	"            </div>\n"
      );
    }
    if (album["text"] != null) {
      html.push(
	"            <div class=\"gallery-album-text\">\n",
	"              <div class=\"gallery-album-text-content\">\n",
	`                ${album["text"]}\n`,
	"              </div>\n",
	"            </div>\n"
      );
    }
    html.push(
      "          </div>\n"
    );
  }
  html.push(
    "        </div>\n",
    "        <nav class=\"pagination\" id=\"pagination\">\n",
  );
  for (let i = 0; i < arr.length; ++i) {
    html.push(
      `          <a class="page-number" href="${path.posix.join(opts["rootDir"], getPageFileName(i))}">${i + 1}</a>\n`
    );
  }
  html.push(
    "        </nav>\n",
    "      </main>\n",
    "      <footer>\n",
  );
  if (opts["info"] != null) {
    html.push(
      "       <div class=\"info\" id=\"info\">\n",
      `         ${opts["info"]}\n`,
      "       </div>\n"
    );
  }
  html.push(
    "     </footer>\n",
    "    </div>\n",
    "  </body>\n",
    "</html>\n",
    `<!-- Page built by AZGallery v${getVersion()} at ${new Date().toISOString()}. -->`
  );
  const filePath = path.join(docPath, getPageFileName(idx));
  logger.debug(`Creating ${logger.cyan(filePath)}...`);
  return fsp.writeFile(filePath, html.join(""), "utf8");
};

const build = async (dir, opts) => {
  logger = new Logger({"debug": opts["debug"], "color": opts["color"]});
  const configPath = opts["config"] || path.join(dir, "config.json");
  let config = null;
  try {
    config = await loadJSON(configPath);
  } catch (error) {
    logger.error(error);
    return;
  }
  const {docDir, galleryDir, rootDir, perPage, title, subtitle, info} = config;

  const docPath = path.join(dir, docDir);
  // Delete generated pages.
  await Promise.all((await fsp.readdir(docPath)).filter((f) => {
    return f.startsWith("index");
  }).map((f) => {
    const p = path.join(docPath, f);
    logger.debug(`Deleting ${logger.cyan(p)}...`);
    return fsp.rm(p);
  }));
  // Create new pages.
  await Promise.all(
    paginate(
      await readGalleryAlbums(docPath, galleryDir, rootDir),
      perPage
    ).map((cur, idx, arr) => {
      return writePage(cur, idx, arr, docPath, {
	rootDir,
	title,
	subtitle,
	info
      });
    })
  );
};

export default build;
