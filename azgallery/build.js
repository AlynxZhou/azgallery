import * as path from "node:path";
import * as fsp from "node:fs/promises";
import {loadJSON, getPathFn, getURLFn, getVersion} from "./utils.js";
import Logger from "./logger.js";

let logger = null;

const readGalleryAlbums = async (docDir, galleryDir, albumDir) => {
  const fullGalleryDir = path.join(docDir, galleryDir);
  let subDirs;
  try {
    subDirs = await fsp.readdir(fullGalleryDir);
  } catch (error) {
    logger.error(error);
    subDirs = [];
  }
  const strs = await Promise.all(subDirs.map((dir) => {
    return fsp.readFile(path.join(fullGalleryDir, dir, "index.json"), "utf8");
  }));
  const albums = strs.map(JSON.parse).map((metadata) => {
    // Convert relative path to full path.
    metadata["images"] = metadata["images"].map((image) => {
      return path.join(galleryDir, metadata["dir"], image);
    });
    // Also add path to album page here.
    metadata["path"] = path.join(albumDir, metadata["dir"], path.sep);
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

const renderPage = (docPath, albums, getPath, getURL, opts = {}) => {
  opts["pages"] = opts["pages"] || [];

  const html = [];
  html.push(
    "<!DOCTYPE html>\n",
    "<html lang=\"zh-Hans\">\n",
    "  <head>\n",
    "    <meta charset=\"utf-8\">\n",
    "    <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=10\">\n"
  );

  // Open Graph.
  html.push(
    `    <meta property="og:site_name" content="${opts["title"] || "gallery"}">\n`,
    `    <meta property="og:title" content="${opts["title"] || "gallery"}">\n`,
    "    <meta property=\"og:type\" content=\"website\">\n",
    `    <meta property="og:url" content="${getURL(docPath)}">\n`
  );
  // If we have many albums in a page, only choose the first non-empty one.
  for (const album of albums) {
    if (album["images"].length === 0 && album["text"] == null) {
      continue;
    }

    if (album["images"].length !== 0) {
      for (const image of album["images"]) {
	html.push(
	  `<meta property="og:image" content="${getURL(image)}">\n`
	);
      }
    }

    if (album["text"] != null) {
      html.push(
	`<meta property="og:description" content="${album["text"]}">\n`
      );
    }
    break;
  }

  html.push(
    `    <link rel="stylesheet" type="text/css" href="${getPath("css/normalize.css")}">\n`,
    `    <link rel="stylesheet" type="text/css" href="${getPath("css/index.css")}">\n`,
    // `    <script type="text/javascript" src="${getPath("js/index.js")}"></script>\n`,
    `    <title>${opts["title"] || "gallery"}</title>\n`,
    "  </head>\n",
    "  <body>\n",
    "    <div class=\"container timeline\">\n",
    "      <header>\n"
  );
  if (opts["title"] != null) {
    html.push(
      "        <div class=\"title\" id=\"title\">\n",
      `          <a href="${getPath()}">${opts["title"]}</a>\n`,
      "        </div>\n"
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
    if (album["images"].length === 0 && album["text"] == null) {
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
        `          <h1 class="gallery-created">${lastYear}</h1>\n`
      );
    }
    if (obj["month"] !== lastMonth || obj["day"] !== lastDay) {
      lastMonth = obj["month"];
      lastDay = obj["day"];
      html.push(
        `          <h2 class="gallery-created">${lastMonth}-${lastDay}</h2>\n`
      );
    }
    html.push(
      "          <div class=\"gallery-album\">\n",
      "            <h4 class=\"gallery-created\">\n",
      `              <a class="album-link" href="${getPath(album["path"])}">${obj["hour"]}:${obj["minute"]}:${obj["second"]}</a>\n`,
      "            </h4>\n"
    );
    if (album["images"].length !== 0) {
      html.push(
        "            <div class=\"gallery-album-images\">\n"
      );
      for (const image of album["images"]) {
        html.push(
          "              <div class=\"gallery-album-image card\">\n",
          `                <a class="image-link" target="_blank" href="${getPath(image)}"><img src="${getPath(image)}"></a>\n`,
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
    "        </div>\n"
  );
  if (opts["pages"] != null) {
    html.push(
      "        <nav class=\"pagination\" id=\"pagination\">\n",
    );
    for (let i = 0; i < opts["pages"].length; ++i) {
      if (i === opts["idx"]) {
        html.push(
          `          <a class="page-number current" href="${getPath(getPageFileName(i))}">${i + 1}</a>\n`
        );
      } else {
        html.push(
          `          <a class="page-number" href="${getPath(getPageFileName(i))}">${i + 1}</a>\n`
        );
      }
    }
    html.push(
      "        </nav>\n"
    );
  }
  html.push(
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

  return html.join("");
};

const writeAlbumPage = async (album, docDir, albumDir, getPath, getURL, opts = {}) => {
  if (album["images"].length === 0 && album["text"] == null) {
    return null;
  }

  const docPath = path.join(albumDir, album["dir"], "index.html");
  const filePath = path.join(docDir, docPath);
  logger.debug(`Creating ${logger.cyan(filePath)}...`);
  await fsp.mkdir(path.dirname(filePath));
  return fsp.writeFile(filePath, renderPage(docPath, [album], getPath, getURL, opts), "utf8");
};

const writeIndexPage = (albums, idx, pages, docDir, getPath, getURL, opts = {}) => {
  const docPath = getPageFileName(idx);
  const filePath = path.join(docDir, docPath);
  logger.debug(`Creating ${logger.cyan(filePath)}...`);
  return fsp.writeFile(filePath, renderPage(docPath, albums, getPath, getURL, {pages, idx, ...opts}), "utf8");
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
  const {
    docDir,
    galleryDir,
    albumDir,
    baseURL,
    rootDir,
    perPage,
    title,
    subtitle,
    info
  } = config;

  const fullDocDir = path.join(dir, docDir);
  // Delete generated pages.
  await Promise.all([
    albumDir,
    ...(await fsp.readdir(fullDocDir)).filter((f) => {
      return f.startsWith("index");
    })
  ].map((f) => {
    const p = path.join(fullDocDir, f);
    logger.debug(`Deleting ${logger.cyan(p)}...`);
    return fsp.rm(p, {"recursive": true, "force": true});
  }));
  // Create new pages.
  const albums = await readGalleryAlbums(fullDocDir, galleryDir, albumDir);
  await fsp.mkdir(path.join(fullDocDir, albumDir));
  const getPath = getPathFn(rootDir);
  const getURL = getURLFn(baseURL, rootDir);
  await Promise.all([
    ...albums.map((album) => {
      return writeAlbumPage(album, fullDocDir, albumDir, getPath, getURL, {
        title,
        subtitle,
        info
      });
    }),
    ...paginate(albums, perPage).map((albums, idx, pages) => {
      return writeIndexPage(albums, idx, pages, fullDocDir, getPath, getURL, {
        title,
        subtitle,
        info
      });
    })
  ]);
};

export default build;
