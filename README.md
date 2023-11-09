AZGallery
=========

A static gallery website.
-------------------------

<https://gallery.alynx.one/>

# Usage

Copy `config.example.json` to `config.json` and modify it, then run `node bin/azgallery.js --help` for help.

`docDir` is where it put and generate all site files.

`galleryDir` is where it put image albums, should under `docDir`.

`albumDir` is where it generates pages for each albums, should under `docDir`.

Don't forget to modify `CNAME` under your `docDir` to use your own domain.

Run `node bin/azgallery.js create` to create new album.

Run `node bin/azgallery.js build` to re-build the website.

If you want to remove or modify an album, just directly modify the files.

There is a Telegram bot to help create album from mobile devices, see <https://github.com/AlynxZhou/image-collector-bot/>. But it currently needs refactor.
