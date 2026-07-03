import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("offline PWA support", () => {
  it("links a web app manifest from the HTML shell", () => {
    const html = fs.readFileSync("index.html", "utf8");

    expect(html).toContain('rel="manifest"');
    expect(html).toContain("%BASE_URL%manifest.webmanifest");
    expect(html).toContain('name="theme-color"');
  });

  it("registers a base-path aware service worker from the app", () => {
    const app = fs.readFileSync("src/app.ts", "utf8");

    expect(app).toContain("registerServiceWorker(");
    expect(app).toContain("navigator.serviceWorker.register");
    expect(app).toContain("import.meta.env.BASE_URL");
    expect(app).toContain("import.meta.env.PROD");
  });

  it("caches route data and GPX files for offline use", () => {
    const serviceWorker = fs.readFileSync("public/sw.js", "utf8");
    const manifest = fs.readFileSync("public/manifest.webmanifest", "utf8");

    expect(serviceWorker).toContain("data/routes.json");
    expect(serviceWorker).toContain("data/changelog.json");
    expect(serviceWorker).toContain("gpx/day-01.gpx");
    expect(serviceWorker).toContain("gpx/day-14.gpx");
    expect(serviceWorker).toContain("self.addEventListener(\"fetch\"");
    expect(serviceWorker).toContain("caches.open");
    expect(serviceWorker).toContain("cacheShellAssets");
    expect(serviceWorker).toContain("html.matchAll");
    expect(manifest).toContain("2026 鐵駱駝環島路線");
    expect(manifest).toContain("\"display\": \"standalone\"");
  });

  it("refreshes route data and GPX from the network before falling back to cache", () => {
    const serviceWorker = fs.readFileSync("public/sw.js", "utf8");

    expect(serviceWorker).toContain("function isFreshContentRequest");
    expect(serviceWorker).toContain('requestUrl.pathname.endsWith("/data/routes.json")');
    expect(serviceWorker).toContain('requestUrl.pathname.endsWith("/data/changelog.json")');
    expect(serviceWorker).toContain('requestUrl.pathname.includes("/gpx/")');
    expect(serviceWorker).toContain("networkFirstContent(request)");
    expect(serviceWorker).toContain('fetch(request, { cache: "no-store" })');
  });
});
