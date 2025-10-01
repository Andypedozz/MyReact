// Mini React-like con Virtual DOM (modulo)
// Salva come MyReact.js e importa con
// `import { div, h1, button, useState, renderComponent } from './MyReact.js'`

// Stato corrente dell'istanza componente in fase di rendering
let currentInstance = null;
let rerender = null;

// Hook useState
function useState(initial) {
    if (!currentInstance) {
        throw new Error("useState deve essere chiamato all'interno di una funzione componente");
    }
    const instance = currentInstance;
    const idx = instance.cursor;

    if (instance.state[idx] === undefined) {
        instance.state[idx] = initial;
    }

    function setState(newValue) {
        instance.state[idx] = typeof newValue === "function"
            ? newValue(instance.state[idx])
            : newValue;
        if (rerender) rerender();
    }

    instance.cursor++;
    console.log(instance.state[idx])
    return [instance.state[idx], setState];
}

// ------------------ Virtual DOM ------------------

function createVNode(tag, props, children) {
    return { tag, props: props || {}, children: children || [] };
}

function createComponentVNode(fn, props, children) {
    return { tag: fn, props: props || {}, children: children || [], isComponent: true, instance: null, rendered: null, el: null };
}

function h(tag, props, ...children) {
    // funzione componente
    if (typeof tag === "function") {
        // FIX: intercetta la chiamata diretta senza argomenti (es. PageA())
        if (props === undefined && children.length === 0) {
            return createComponentVNode(tag, {}, []);
        }

        const realProps = (props && typeof props === 'object' && !Array.isArray(props)) ? props : {};
        const realChildren = (props && typeof props === 'object' && !Array.isArray(props)) ? children : [props, ...children];
        const flatChildren = realChildren.flat().filter(c => c !== undefined && c !== null);
        return createComponentVNode(tag, realProps, flatChildren);
    }

    // tag HTML normale
    if (
        props == null ||
        typeof props !== "object" ||
        Array.isArray(props) ||
        props.tag !== undefined
    ) {
        children = [props, ...children];
        props = {};
    }

    const flatChildren = children.flatMap(c => Array.isArray(c) ? c : [c]).filter(c => c !== undefined && c !== null);
    return createVNode(tag, props, flatChildren);
}

// ------------------ Lifecycle: Unmount ------------------

function unmount(vnode) {
    if (!vnode) return;

    if (typeof vnode === "string" || typeof vnode === "number") return;

    if (vnode.isComponent) {
        if (vnode.rendered) unmount(vnode.rendered);
        if (vnode.instance) {
            vnode.instance.state = [];
            vnode.instance.cursor = 0;
        }
        vnode.instance = null;
        vnode.rendered = null;
        vnode.el = null;
    } else {
        if (vnode.children && vnode.children.length) {
            vnode.children.forEach(child => unmount(child));
        }
        vnode.el = null;
    }
}

// ------------------ Create DOM ------------------

function createDom(vnode) {
    if (typeof vnode === "string" || typeof vnode === "number") {
        return document.createTextNode(String(vnode));
    }

    if (vnode.isComponent) {
        const instance = vnode.instance || { state: [], cursor: 0 };
        vnode.instance = instance;

        const prevInstance = currentInstance;
        currentInstance = instance;
        instance.cursor = 0;
        const rendered = vnode.tag({ ...vnode.props, children: vnode.children });
        currentInstance = prevInstance;

        vnode.rendered = rendered;
        const dom = createDom(rendered);
        vnode.el = dom;
        return dom;
    }

    const el = document.createElement(vnode.tag);

    for (let [key, value] of Object.entries(vnode.props || {})) {
        if (key.startsWith("on") && typeof value === "function") {
            el[key.toLowerCase()] = value;
        } else {
            el.setAttribute(key, value);
        }
    }

    for (let child of vnode.children || []) {
        el.appendChild(createDom(child));
    }

    vnode.el = el;
    return el;
}

// ------------------ Update DOM ------------------

function updateDom(parent, oldVNode, newVNode, index = 0) {
    if (oldVNode == undefined || oldVNode == null) {
        parent.appendChild(createDom(newVNode));
        return;
    }

    if (newVNode == undefined || newVNode == null) {
        unmount(oldVNode);
        const node = parent.childNodes[index];
        if (node) parent.removeChild(node);
        return;
    }

    const oldIsPrimitive = typeof oldVNode === "string" || typeof oldVNode === "number";
    const newIsPrimitive = typeof newVNode === "string" || typeof newVNode === "number";

    if (oldIsPrimitive || newIsPrimitive) {
        if (oldVNode !== newVNode) {
            parent.replaceChild(createDom(newVNode), parent.childNodes[index]);
        }
        return;
    }

    if (oldVNode.tag !== newVNode.tag || !!oldVNode.isComponent !== !!newVNode.isComponent) {
        unmount(oldVNode);
        parent.replaceChild(createDom(newVNode), parent.childNodes[index]);
        return;
    }

    if (newVNode.isComponent) {
        newVNode.instance = oldVNode.instance || { state: [], cursor: 0 };

        const prevInstance = currentInstance;
        currentInstance = newVNode.instance;
        newVNode.instance.cursor = 0;
        const rendered = newVNode.tag({ ...newVNode.props, children: newVNode.children });
        currentInstance = prevInstance;

        updateDom(parent, oldVNode.rendered, rendered, index);

        newVNode.rendered = rendered;
        newVNode.el = parent.childNodes[index];
        return;
    }

    const el = parent.childNodes[index];

    for (let [key, value] of Object.entries(newVNode.props || {})) {
        if (key.startsWith("on") && typeof value === "function") {
            el[key.toLowerCase()] = value;
        } else {
            el.setAttribute(key, value);
        }
    }

    for (let key in (oldVNode.props || {})) {
        if (!(key in (newVNode.props || {}))) {
            if (key.startsWith("on")) {
                el[key.toLowerCase()] = null;
            } else {
                el.removeAttribute(key);
            }
        }
    }

    const maxLen = Math.max(oldVNode.children.length, newVNode.children.length);
    for (let i = 0; i < maxLen; i++) {
        updateDom(el, oldVNode.children[i], newVNode.children[i], i);
    }

    newVNode.el = el;
}

// ------------------ Render root component ------------------

let oldTree = null;

function renderComponent(root, component) {
    rerender = () => renderComponent(root, component);
    const newTree = h(component, {});
    if (!oldTree) {
        root.innerHTML = "";
        root.appendChild(createDom(newTree));
    } else {
        updateDom(root, oldTree, newTree);
    }
    oldTree = newTree;
}

// ------------------ Tag factory ------------------

const tags = ["html","head","title","base","link","meta","style","body","header","nav","main","section","article","aside","footer","h1","h2","h3","h4","h5","h6","hgroup","p","hr","pre","blockquote","ol","ul","li","dl","dt","dd","figure","figcaption","div","a","em","strong","small","s","cite","q","dfn","abbr","data","time","code","samp","kbd","sub","sup","i","b","u","mark","ruby","rt","rp","bdi","bdo","span","br","wbr","img","audio","video","track","map","area","picture","embed","object","param","iframe","source","script","noscript","canvas","template","slot","del","ins","table","caption","colgroup","col","thead","tbody","tfoot","tr","th","td","form","fieldset","legend","label","input","button","select","datalist","optgroup","option","textarea","output","details","summary","dialog","menu","menuitem"];

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