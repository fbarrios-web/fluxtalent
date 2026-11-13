import { test } from "node:test";
import assert from "node:assert/strict";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { sitemapStaticPaths, sitemapXML } from "./sitemap.ts";

test("public pages are included but private descendants and token routes are excluded", () => {
  const root = createRootRoute({ staticData: { sitemap: false } });
  const home = createRoute({ getParentRoute: () => root, path: "/", staticData: { sitemap: true } });
  const demo = createRoute({ getParentRoute: () => root, path: "reservar-demo", staticData: { sitemap: true } });
  const app = createRoute({ getParentRoute: () => root, path: "app", staticData: { sitemap: "exclude-subtree" } });
  const child = createRoute({ getParentRoute: () => app, path: "clients", staticData: { sitemap: true } });
  const token = createRoute({ getParentRoute: () => root, path: "schedule/$token", staticData: { sitemap: false } });
  const router = createRouter({ routeTree: root.addChildren([home, demo, app.addChildren([child]), token]) });
  assert.deepEqual(sitemapStaticPaths(router), ["/", "/reservar-demo"]);
});

test("XML uses the public origin, deduplicates URLs and omits invented modification dates", () => {
  const xml = sitemapXML("https://fluxtalent.lovable.app", [{ path: "/" }, { path: "/" }, { path: "/reservar-demo" }]);
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
  assert.ok(xml.includes("<loc>https://fluxtalent.lovable.app/reservar-demo</loc>"));
  assert.equal(xml.includes("lastmod"), false);
  assert.throws(() => sitemapXML("https://fluxtalent.lovable.app", [{ path: "//other.example" }]));
});