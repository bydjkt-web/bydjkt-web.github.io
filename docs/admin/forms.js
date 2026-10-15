/* Mesin form berbasis skema: text | area | num | bool | select | strlist | objlist | obj */
(function (root) {
  "use strict";
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, ""); else if (v !== false && v != null) e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function blank(fields) {
    var o = {};
    fields.forEach(function (f) {
      o[f.k] = f.t === "bool" ? false : f.t === "num" ? 0 : f.t === "strlist" || f.t === "objlist" ? [] : f.t === "obj" ? blank(f.fields) : (f.def != null ? f.def : "");
    });
    return o;
  }
  function field(f, obj, onChange, path) {
    var id = "f_" + path.replace(/\W+/g, "_");
    var label = h("label", { class: "f", for: id }, [f.label || f.k, f.hint ? h("small", { text: f.hint }) : null]);
    function set(v) { obj[f.k] = v; onChange(path); }
    var v = obj[f.k];
    switch (f.t) {
      case "bool":
        return h("label", { class: "chk" }, [h("input", { type: "checkbox", id: id, checked: !!v, onchange: function (e) { set(e.target.checked); } }), f.label || f.k]);
      case "area":
        label.appendChild(h("textarea", { id: id, rows: f.rows || 4, oninput: function (e) { set(e.target.value); } }, [v == null ? "" : String(v)]));
        label.lastChild.value = v == null ? "" : String(v);
        return label;
      case "num":
        label.appendChild(h("input", { type: "number", id: id, value: v == null ? "" : v, oninput: function (e) { set(e.target.value === "" ? 0 : Number(e.target.value)); } }));
        return label;
      case "select": {
        var s = h("select", { id: id, onchange: function (e) { set(e.target.value); } }, (f.opts || []).map(function (o) {
          var val = Array.isArray(o) ? o[0] : o, lab = Array.isArray(o) ? o[1] : o;
          return h("option", { value: val, selected: val === v }, [lab]);
        }));
        label.appendChild(s); return label;
      }
      case "strlist": return list(f, obj, onChange, path, true);
      case "objlist": return list(f, obj, onChange, path, false);
      case "obj": {
        var box = h("div", { class: "sub-list" }, [h("strong", { text: f.label || f.k })]);
        obj[f.k] = obj[f.k] || blank(f.fields);
        f.fields.forEach(function (sf) { box.appendChild(field(sf, obj[f.k], onChange, path + "." + sf.k)); });
        return box;
      }
      default:
        label.appendChild(h("input", { type: f.t === "url" ? "url" : "text", id: id, value: v == null ? "" : v, placeholder: f.placeholder || "", oninput: function (e) { set(e.target.value); } }));
        return label;
    }
  }
  function list(f, obj, onChange, path, simple) {
    var wrap = h("div", { class: "sub-list" });
    function redraw() {
      wrap.innerHTML = "";
      wrap.appendChild(h("strong", { text: f.label || f.k }));
      if (f.hint) wrap.appendChild(h("div", { class: "muted", text: f.hint }));
      obj[f.k] = obj[f.k] || [];
      var arr = obj[f.k];
      arr.forEach(function (item, i) {
        var box = h("div", { class: "sub-item" });
        if (simple) {
          var inp = f.area ? h("textarea", { rows: 3, oninput: function (e) { arr[i] = e.target.value; onChange(path); } }) : h("input", { type: "text", oninput: function (e) { arr[i] = e.target.value; onChange(path); } });
          inp.value = item; box.appendChild(inp);
        } else {
          if (f.titleKey && item[f.titleKey]) box.appendChild(h("strong", { text: item[f.titleKey] }));
          f.fields.forEach(function (sf) { box.appendChild(field(sf, item, onChange, path + "." + i + "." + sf.k)); });
        }
        box.appendChild(h("div", { class: "row" }, [
          h("button", { type: "button", class: "btn o sm", text: "↑", disabled: i === 0, onclick: function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); onChange(path); redraw(); } }),
          h("button", { type: "button", class: "btn o sm", text: "↓", disabled: i === arr.length - 1, onclick: function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); onChange(path); redraw(); } }),
          h("button", { type: "button", class: "btn d sm", text: "Hapus", onclick: function () { arr.splice(i, 1); onChange(path); redraw(); } })
        ]));
        wrap.appendChild(box);
      });
      wrap.appendChild(h("button", { type: "button", class: "btn o sm", text: "+ Tambah", onclick: function () { arr.push(simple ? "" : blank(f.fields)); onChange(path); redraw(); } }));
    }
    redraw();
    return wrap;
  }
  function render(fields, data, onChange) {
    var root_ = h("div");
    fields.forEach(function (f) { root_.appendChild(field(f, data, onChange || function () {}, f.k)); });
    return root_;
  }
  root.Forms = { render: render, blank: blank, h: h };
})(window);
