(async () => {
  const fs = require("fs/promises");
  const path = require("path");
  const config = require("./config.json");

  const writeSiteData = () => {
    const data = {
      "title": config["title"],
      "subtitle": config["subtitle"],
      "info": config["info"]
    };
    return fs.writeFile(
      path.join(__dirname, config["docDir"], "data", "site.json"),
      JSON.stringify(data), "utf8"
    );
  };
  
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

  const writeGalleryData = (albums) => {
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
    const pageFiles = [];
    for (let i = 0; i < pages.length; ++i) {
      pageFiles.push(`gallery-${i + 1}.json`);
    }
    const gallery = {
      "albumsLength": albums.length,
      "pages": pageFiles.map((fileName) => {
        return path.posix.join(config["rootDir"], "data", fileName);
      })
    };    
    return Promise.all(pageFiles.map((fileName, i) => {
      return fs.writeFile(
        path.join(__dirname, config["docDir"], "data", fileName),
        JSON.stringify({"albums": pages[i]}), "utf8"
      );
    }).concat([
      fs.writeFile(
        path.join(__dirname, config["docDir"], "data", "gallery.json"),
        JSON.stringify(gallery), "utf8"
      )
    ]));
  };
    
  await fs.rm(
    path.join(__dirname, config["docDir"], "data"),
    {"recursive": true, "force": true}
  );
  await fs.mkdir(
    path.join(__dirname, config["docDir"], "data"), {"recursive": true}
  );
  await Promise.all([
    writeSiteData(), writeGalleryData(await readGalleryAlbums())
  ]);
})();
