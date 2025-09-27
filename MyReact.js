// ------------------ Mini React-like con Virtual DOM ------------------

let states = [];
let cursor = 0;
let rerender = null;

// Hook useState
function useState(initial) {
    const idx = cursor;
    // Inizializza lo stato solo la prima volta
    states[idx] = states[idx] ?? initial;

    function setState(newValue) {
        // Se newValue è funzione, leggiamo sempre dallo stato corrente
        states[idx] = typeof newValue === "function" ? newValue(states[idx]) : newValue;
        if (rerender) rerender(); // trigger re-render
    }

    cursor++;
    return [states[idx], setState];
}

// ------------------ Virtual DOM ------------------

// Crea un Virtual Node (VNode)
function createVNode(tag, props, children) {
    return { tag, props: props || {}, children };
}

// Funzione helper robusta: crea VNode
function h(tag, props, ...children) {
    // Caso 1: props non è un oggetto "reale" → è un child
    if (
        props == null ||                       // null o undefined
        typeof props !== "object" ||           // string, number, boolean
        Array.isArray(props) ||                // array
        props.tag !== undefined                // è un VNode
    ) {
        children = [props, ...children];
        props = {};
    }

    // Appiattiamo eventuali array nei children
    const flatChildren = children.flatMap(c => Array.isArray(c) ? c : [c]);

    return createVNode(tag, props, flatChildren);
}


// Render VNode → DOM Node
function createDom(vnode) {
    if (typeof vnode === "string" || typeof vnode === "number") {
        return document.createTextNode(vnode);
    }

    const el = document.createElement(vnode.tag);

    for (let [key, value] of Object.entries(vnode.props)) {
        if (key.startsWith("on") && typeof value === "function") {
            el.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    }

    vnode.children.forEach(child => {
        el.appendChild(createDom(child));
    });

    vnode.el = el; // salva il riferimento al DOM reale
    return el;
}

// Diffing: confronta e aggiorna
function updateDom(parent, oldVNode, newVNode, index = 0) {
    if (!oldVNode) {
        // Aggiungi nuovo nodo
        parent.appendChild(createDom(newVNode));
    } else if (!newVNode) {
        // Rimuovi nodo
        parent.removeChild(parent.childNodes[index]);
    } else if (typeof oldVNode !== typeof newVNode || 
               (typeof newVNode === "string" && oldVNode !== newVNode) ||
               oldVNode.tag !== newVNode.tag) {
        // Nodo completamente diverso → sostituisci
        parent.replaceChild(createDom(newVNode), parent.childNodes[index]);
    } else if (newVNode.tag) {
        // Aggiorna attributi
        const el = parent.childNodes[index];
        // Aggiorna props
        for (let [key, value] of Object.entries(newVNode.props)) {
            if (key.startsWith("on") && typeof value === "function") {
                el[key.toLowerCase()] = value;
            } else {
                el.setAttribute(key, value);
            }
        }
        // Rimuovi vecchi props
        for (let key in oldVNode.props) {
            if (!(key in newVNode.props)) {
                el.removeAttribute(key);
            }
        }
        // Ricorsione sui figli
        const maxLen = Math.max(oldVNode.children.length, newVNode.children.length);
        for (let i = 0; i < maxLen; i++) {
            updateDom(el, oldVNode.children[i], newVNode.children[i], i);
        }
    }
}

// ------------------ Render Component ------------------

let oldTree = null;

function renderComponent(root, component) {
    cursor = 0; // reset per i vari useState
    const newTree = component();
    if (!oldTree) {
        root.innerHTML = "";
        root.appendChild(createDom(newTree));
    } else {
        updateDom(root, oldTree, newTree);
    }
    oldTree = newTree;
}

// ------------------ Lista di tag HTML ------------------

// Lista di tag HTML validi
const tags = ["html", "head", "title", "base", "link", "meta", "style", "body", "header", "nav", "main", "section", "article", "aside", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "hgroup", "p", "hr", "pre", "blockquote", "ol", "ul", "li", "dl", "dt", "dd", "figure", "figcaption", "div", "a", "em", "strong", "small", "s", "cite", "q", "dfn", "abbr", "data", "time", "code", "samp", "kbd", "sub", "sup", "i", "b", "u", "mark", "ruby", "rt", "rp", "bdi", "bdo", "span", "br", "wbr", "img", "audio", "video", "track", "map", "area", "picture", "embed", "object", "param", "iframe", "source", "script", "noscript", "canvas", "template", "slot", "del", "ins", "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td", "form", "fieldset", "legend", "label", "input", "button", "select", "datalist", "optgroup", "option", "textarea", "output", "details", "summary", "dialog", "menu", "menuitem"];

// Factory dei tag HTML
const elements = Object.fromEntries(
  tags.map(tag => [tag, (...args) => {
    let props = {};
    let children = args;

    if (
      args.length > 0 &&
      args[0] != null &&
      typeof args[0] === "object" &&
      !Array.isArray(args[0]) &&
      !(args[0] instanceof Node)
    ) {
      props = args[0];
      children = args.slice(1);
    }

    return h(tag, props, ...children.flat());
  }])
);

// Destruttura i tag per usarli direttamente
const {
  html, head, title, base, link, meta, style, body, header, nav, main, section,
  article, aside, footer, h1, h2, h3, h4, h5, h6, hgroup, p, hr, pre, blockquote,
  ol, ul, li, dl, dt, dd, figure, figcaption, div, a, em, strong, small, s, cite,
  q, dfn, abbr, data, time, code, samp, kbd, sub, sup, i, b, u, mark, ruby, rt,
  rp, bdi, bdo, span, br, wbr, img, audio, video, track, map, area, picture,
  embed, object, param, iframe, source, script, noscript, canvas, template, slot,
  del, ins, table, caption, colgroup, col, thead, tbody, tfoot, tr, th, td,
  form, fieldset, legend, label, input, button, select, datalist, optgroup,
  option, textarea, output, details, summary, dialog, menu, menuitem
} = elements;


// ------------------ Router ------------------

function router(routes) {
    const root = document.getElementById("app");

    function render() {
        const path = window.location.hash.slice(1) || "/";
        const component = routes[path];
        if (component) {
            rerender = () => renderComponent(root, component);
            rerender(); // primo render
        } else {
            root.textContent = "404 - Not found";
        }
    }

    window.addEventListener("hashchange", render);
    render();
}
