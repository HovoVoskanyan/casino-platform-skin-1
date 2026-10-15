import template from "./head.gotmpl?raw";
import indexHtml from "../../index.html?raw";
import en from "@/i18n/locales/en-PH.json";
import fil from "@/i18n/locales/fil.json";
import { serverHead, templateCopy, templateKeys } from "./server-head";

const catalogues = { "en-PH": en, fil };

it("reads its copy from the catalogue — every key it names, the ternaries' too", () => {
  const keys = templateKeys(template);
  for (const k of ["seo.home.title", "seo.game.title", "seo.game.demo", "seo.game.real", "game.seoAbout.noDemo", "game.unavailable", "wallet.title", "nav.signIn"]) {
    expect(keys).toContain(k);
  }
  expect(keys.every((k) => typeof (catalogues["en-PH"] as Record<string, unknown>)[k] === "string")).toBe(true);
});

it("carries each language's own words, and English where a translation is missing", () => {
  const copy = templateCopy(template, { "en-PH": catalogues["en-PH"], fil: { ...catalogues.fil, "seo.game.demo": undefined } });
  expect(copy.fil!["seo.game.title"]).toBe(catalogues.fil["seo.game.title"]);
  expect(copy.fil!["seo.game.demo"]).toBe(catalogues["en-PH"]["seo.game.demo"]);
});

it("refuses to build on a key the catalogue lacks", () => {
  expect(() => serverHead(indexHtml, template.replace('"seo.home.title"', '"seo.home.titel"'), catalogues)).toThrow(/seo\.home\.titel/);
});

it("refuses copy a Go raw string cannot hold", () => {
  const withTick = { ...catalogues, "en-PH": { ...catalogues["en-PH"], "seo.home.title": "Cho`Cho" } };
  expect(() => serverHead(indexHtml, template, withTick)).toThrow(/backtick/);
});

it("puts the facts first, the language on <html>, the tags in the head and the noscript in the body", () => {
  const html = serverHead(indexHtml, template, catalogues);
  expect(html.startsWith("<!doctype html>{{-")).toBe(true);
  expect(html).toContain('<html lang="{{ $lang }}">');
  expect(html).not.toContain("seo:head");
  expect(html).not.toContain("seo:body");
  expect(html).not.toContain("__COPY__`");
  expect(html.indexOf("<title>{{ $fullTitle")).toBeGreaterThan(html.indexOf("<head>"));
  expect(html.indexOf("<noscript>")).toBeGreaterThan(html.indexOf("<body>"));
  // the dev server's index.html is plain HTML: no Go template in it for Caddy to trip on, and the defaults stay
  expect(indexHtml).not.toContain("{{");
  expect(indexHtml).toContain("<!-- seo:head -->");
});
