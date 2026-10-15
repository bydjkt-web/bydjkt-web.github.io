// Bandingkan output md.js dengan tools/lib/md.py pada semua artikel/halaman + sampel
const MD = require("../src/admin/md.js");
const fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.join(__dirname, "..");
const files = [];
for (const d of ["content/articles", "content/pages"]) for (const f of fs.readdirSync(path.join(root, d))) if (f.endsWith(".md")) files.push(path.join(root, d, f));
const sample = path.join(__dirname, "sample.md");
fs.writeFileSync(sample, "## Judul *miring* & `kode`\n\nParagraf **tebal** [link](/x/) [ext](https://a.b/c) 5 * 3.\n\n- a\n- b\n\n1. satu\n2. dua\n\n> kutip\n> dua\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n![alt teks](/img/a.webp \"Caption\")\n\n{{cta model=x}}\n\n### Sub\n\nIsi.\n\n## FAQ\n\n### Apa?\n\nJawab  satu\ndua.\n\n### Siapa?\n\nSaya.\n");
files.push(sample);
const py = `
import sys,json
sys.path.insert(0,'${root}/tools/lib')
import md
out=[]
for f in sys.argv[1:]:
    t=open(f,encoding='utf-8').read()
    if t.startswith('---'): t=t.split('\\n---\\n',1)[1]
    h,heads,faqs=md.render(t.strip()+'\\n',shortcode=lambda n,a:'[['+n+']]')
    out.append({'html':h,'heads':[list(x) for x in heads],'faqs':[list(x) for x in faqs]})
print(json.dumps(out))`;
const expected = JSON.parse(cp.execFileSync("python3", ["-c", py, ...files], { encoding: "utf-8", maxBuffer: 1e8 }));
let bad = 0;
files.forEach((f, k) => {
  let t = fs.readFileSync(f, "utf-8");
  if (t.startsWith("---")) t = t.split("\n---\n").slice(1).join("\n---\n");
  const r = MD.render(t.trim() + "\n", { shortcode: (n) => "[[" + n + "]]" });
  const ok = r.html === expected[k].html && JSON.stringify(r.heads) === JSON.stringify(expected[k].heads) && JSON.stringify(r.faqs) === JSON.stringify(expected[k].faqs);
  if (!ok) { bad++; console.log("BEDA:", path.basename(f)); 
    const a = r.html.split("\n"), b = expected[k].html.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { console.log(" js:", a[i]); console.log(" py:", b[i]); break; } }
});
fs.unlinkSync(sample);
console.log(bad ? bad + " berbeda" : "md paritas OK (" + files.length + " file)");
process.exit(bad ? 1 : 0);
