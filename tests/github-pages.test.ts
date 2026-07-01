import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Pages deployment", () => {
  it("publishes the built site and route assets from GitHub Actions", () => {
    const workflow = fs.readFileSync(".github/workflows/deploy-pages.yml", "utf8");

    expect(workflow).toContain("actions/configure-pages");
    expect(workflow).toContain("actions/upload-pages-artifact");
    expect(workflow).toContain("actions/deploy-pages");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run validate");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("cp data/routes.json dist/data/routes.json");
    expect(workflow).toContain("cp gpx/*.gpx dist/gpx/");
  });

  it("configures Vite for a GitHub Pages repository base path", () => {
    const config = fs.readFileSync("vite.config.ts", "utf8");

    expect(config).toContain("VITE_BASE_PATH");
  });
});
