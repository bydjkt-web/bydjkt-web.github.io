// node build.mjs  -> menulis ke ../../src/assets/vendor
import { build } from "esbuild";
import * as sass from "sass";
import fs from "node:fs";
const out = new URL("../../src/assets/vendor/", import.meta.url).pathname;
fs.mkdirSync(out, { recursive: true });
await build({ entryPoints: ["src/swiper-entry.js"], bundle: true, minify: true, format: "iife", target: "es2018", outfile: out + "swiper.min.js", legalComments: "none" });
fs.writeFileSync(".tmp-swiper.css", ["swiper/swiper.css", "swiper/modules/pagination.css", "swiper/modules/a11y.css"].map(f => fs.readFileSync("node_modules/" + f, "utf8")).join("\n"));
await build({ entryPoints: [".tmp-swiper.css"], minify: true, outfile: out + "swiper.min.css", loader: { ".css": "css" } });
fs.unlinkSync(".tmp-swiper.css");
await build({ entryPoints: ["node_modules/aos/dist/aos.js"], minify: true, format: "iife", globalName: "AOS", outfile: out + "aos.min.js", legalComments: "none" });
for (const [src, dst] of [["src/bootstrap-lite.scss", "bootstrap-lite.css"], ["src/aos-scoped.scss", "aos.min.css"]]) {
  const r = sass.compile(src, { loadPaths: ["node_modules"], style: "compressed", quietDeps: true, silenceDeprecations: ["import", "global-builtin", "mixed-decls", "color-functions"] });
  fs.writeFileSync(out + dst, r.css);
}
for (const f of fs.readdirSync(out)) console.log(f, fs.statSync(out + f).size);
