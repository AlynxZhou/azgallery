(async () => {
  const fs = require("fs/promises");
  const path = require("path");
  const config = require("./config.json");

  const readGalleryAlbums = async () => {
    const subDirs = await fs.readdir(
      path.join(__dirname, config["docDir"], config["galleryDir"])
    );
    const strs = await Promise.all(subDirs.map((dir) => {
      return fs.readFile(
        path.join(
          __dirname, config["docDir"], config["galleryDir"], dir, "index.json"
        ),
        "utf8"
      );
    }));
    const albums = strs.map(JSON.parse).map((metadata) => {
      metadata["images"] = metadata["images"].map((image) => {
        return path.posix.join(
          config["rootDir"], config["galleryDir"], metadata["dir"], image
        );
      });
      return metadata;
    });
    // Newest first.
    albums.sort((a, b) => {
      return b["created"] - a["created"];
    });
    return albums;
  };

  const paginate = (albums) => {
    const perPage = config["perPage"] || albums.length;
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
    return idx ? `${basename}-${idx + 1}.html` : `${basename}.html`;
  };

  const writePage = (cur, idx, arr) => {
    const html = [];
    html.push(
      "<!DOCTYPE html>\n",
      "<html lang=\"zh-Hans\">\n",
      "  <head>\n",
      "    <meta charset=\"utf-8\">\n",
      "    <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n",
      "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=10\">\n",
      `    <link rel="stylesheet" type="text/css" href="${path.posix.join(config["rootDir"], "css/normalize.css")}">\n`,
      `    <link rel="stylesheet" type="text/css" href="${path.posix.join(config["rootDir"], "css/index.css")}">\n`,
      // `    <script type="text/javascript" src="${path.posix.join(config["rootDir"], "js/index.js")}"></script>\n`,
      `    <title>${config["title"] || "gallery"}</title>\n`,
      "  </head>\n",
      "  <body>\n",
      "    <div class=\"container timeline\">\n",
      "      <header>\n"
    );
    if (config["title"] != null) {
      html.push(
        `        <div class="title" id="title">${config["title"]}</div>\n`
      );
    }
    if (config["subtitle"] != null) {
      html.push(
        `        <div class="subtitle" id="subtitle">${config["subtitle"]}</div>\n`
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
        `          <a class="page-number" href="${path.posix.join(config["rootDir"], getPageFileName(i))}">${i + 1}</a>\n`
      );
    }
    html.push(
      "        </nav>\n",
      "      </main>\n",
      "      <footer>\n",
    );
    if (config["info"] != null) {
      html.push(
        "       <div class=\"info\" id=\"info\">\n",
        `         ${config["info"]}\n`,
        "       </div>\n"
      );
    }
    html.push(
      "     </footer>\n",
      "    </div>\n",
      "  </body>\n",
      "</html>\n",
    );
    const filePath = path.join(
      __dirname, config["docDir"], getPageFileName(idx)
    );
    return fs.writeFile(filePath, html.join(""), "utf8");
  };

  // Delete generated pages.
  await Promise.all((await fs.readdir(
    path.join(__dirname, config["docDir"])
  )).filter((f) => {
    return f.startsWith("index");
  }).map((f) => {
    return fs.rm(path.join(__dirname, config["docDir"], f));
  }));
  // Create new pages.
  await Promise.all(paginate(await readGalleryAlbums()).map(writePage));
})();
