"use strict";

const documentReady = (callback) => {
  if (callback == null) {
    return;
  }
  if (
    document.readyState === "complete" || document.readyState === "interactive"
  ) {
    window.setTimeout(callback, 0);
  } else {
    document.addEventListener("DOMContentLoaded", callback);
  }
};

documentReady(() => {
  fetch("data/site.json").then((response) => {
    return response.json();
  }).then((siteData) => {
    if (siteData["title"] != null) {
      const titleElement = document.getElementById("title");
      titleElement.innerHTML = siteData["title"];
    }
    if (siteData["subtitle"] != null) {
      const subtitleElement = document.getElementById("subtitle");
      subtitleElement.innerHTML = siteData["subtitle"];
    }
    if (siteData["info"] != null) {
      const infoElement = document.getElementById("info");
      infoElement.innerHTML = siteData["info"];
    }
  });
  fetch("data/gallery.json").then((response) => {
    return response.json();
  }).then((galleryData) => {
    const {pages} = galleryData;
    const paginationElement = document.getElementById("pagination");
    const results = [];
    for (let i = 0; i < pages.length; ++i) {
      results.push(`<a class="page-number" href="?p=${i + 1}">${i + 1}</a>`);
    }
    paginationElement.innerHTML = results.join("");
    const searchParams = new window.URLSearchParams(window.location.search);
    const page = searchParams.has("p") ? searchParams.get("p") : 1;
    const pagePath = page > pages.length ? pages[0] : pages[page - 1];
    return fetch(pagePath);
  }).then((response) => {
    return response.json();
  }).then((pageData) => {
    const {albums} = pageData;
    const galleryElement = document.getElementById("gallery");
    const results = [];
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
      const created = new Date(album["created"]);
      const parts = formatter.formatToParts(created);
      const obj = {};
      for (let {type, value} of parts) {
        obj[type] = value;
      }
      if (obj["year"] !== lastYear) {
        lastYear = obj["year"];
        results.push(`<h1 class="gallery-date">${lastYear}</h1>`);
      }
      if (obj["month"] !== lastMonth || obj["day"] !== lastDay) {
        lastMonth = obj["month"];
        lastDay = obj["day"];
        results.push(`<h2 class="gallery-date">${lastMonth}-${lastDay}</h2>`);
      }
      results.push("<div class=\"gallery-album\">");
      results.push("<h4 class=\"gallery-date\">");
      results.push(`${obj["hour"]}:${obj["minute"]}:${obj["second"]}`);
      results.push("</h4>");
      if (album["images"] != null) {
        results.push("<div class=\"gallery-album-images\">");
        for (const image of album["images"]) {
          results.push("<div class=\"gallery-album-image card\">");
          results.push(`<a class="image-link" target="_blank" href="${image}"><img src="${image}"></a>`);
          results.push("</div>");
        }
        results.push("</div>");
      }
      if (album["text"] != null) {
        results.push("<div class=\"gallery-album-text\">");
        results.push(album["text"]);
        results.push("</div>");
      }
      if (album["authors"] != null) {
        results.push("<div class=\"gallery-album-authors\">");
        results.push("<ul>");
        for (const author of album["authors"]) {
          results.push(`<li>${author}</li>`);
        }
        results.push("</ul>");
        results.push("</div>");
      }
      results.push("</div>");
    }
    galleryElement.innerHTML = results.join("");
  });
});
