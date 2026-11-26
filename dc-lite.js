/* Minimal runtime for the exported pages: renders {{holes}}, <sc-for>, <sc-if> and onX handlers. */
(function () {
  function lookup(expr, scopes) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    var parts = expr.split('.');
    for (var i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i] && Object.prototype.hasOwnProperty.call(scopes[i], parts[0])) {
        var v = scopes[i][parts[0]];
        for (var j = 1; j < parts.length; j++) { if (v == null) return undefined; v = v[parts[j]]; }
        return v;
      }
    }
    return undefined;
  }
  var WHOLE = /^\s*\{\{([^}]+)\}\}\s*$/;
  var ANY = /\{\{([^}]+)\}\}/g;
  function interp(str, scopes) {
    return str.replace(ANY, function (_, e) { var v = lookup(e, scopes); return v == null ? '' : String(v); });
  }
  function renderNode(node, scopes, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scopes))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      var listAttr = node.getAttribute('list') || '';
      var m = listAttr.match(WHOLE);
      var list = m ? lookup(m[1], scopes) : [];
      var as = node.getAttribute('as') || 'item';
      (list || []).forEach(function (item, idx) {
        var s = {}; s[as] = item; s.$index = idx;
        var ns = scopes.concat([s]);
        node.childNodes.forEach(function (c) { renderNode(c, ns, out); });
      });
      return;
    }
    if (tag === 'sc-if') {
      var va = node.getAttribute('value') || '';
      var mm = va.match(WHOLE);
      if (mm ? lookup(mm[1], scopes) : false) node.childNodes.forEach(function (c) { renderNode(c, scopes, out); });
      return;
    }
    var el = document.createElement(tag);
    Array.prototype.forEach.call(node.attributes, function (a) {
      var name = a.name;
      if (name.indexOf('hint-') === 0) return;
      var w = a.value.match(WHOLE);
      if (name.indexOf('on') === 0 && w) {
        var fn = lookup(w[1], scopes);
        if (typeof fn === 'function') el.addEventListener(name.slice(2), function (ev) { fn(ev); });
        return;
      }
      el.setAttribute(name, interp(a.value, scopes));
    });
    var src = tag === 'template' ? node.content : node;
    src.childNodes.forEach(function (c) { renderNode(c, scopes, el); });
    out.appendChild(el);
  }
  window.DCLogic = function DCLogic(props) { this.props = props || {}; this.state = {}; };
  window.DCLogic.prototype.setState = function (patch) {
    if (typeof patch === 'function') patch = patch(this.state, this.props);
    this.state = Object.assign({}, this.state, patch);
    if (this.__render) this.__render();
  };
  window.DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__render(); };
  window.mountDC = function (Component) {
    var tpl = document.getElementById('tpl').content;
    var app = document.getElementById('app');
    var inst = new Component({});
    if (!inst.state) inst.state = {};
    inst.__render = function () {
      var vals = inst.renderVals ? inst.renderVals() : {};
      var frag = document.createDocumentFragment();
      tpl.childNodes.forEach(function (c) { renderNode(c, [vals], frag); });
      app.replaceChildren(frag);
    };
    inst.__render();
    if (inst.componentDidMount) inst.componentDidMount();
  };
})();
