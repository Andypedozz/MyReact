let root = null;
let component;

let componentStates = new Map();
let componentEffects = new Map();
let componentStack = [];
let componentIds = new WeakMap();
let nextComponentId = 0;
let activeComponentIds = new Set();

let oldVTree = null;
let domNodeMap = new WeakMap();

function getComponentId(fn) {
    if (!componentIds.has(fn)) {
        componentIds.set(fn, `comp_${nextComponentId++}`);
    }
    return componentIds.get(fn);
}

function useState(initial) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    
    activeComponentIds.add(componentId);
    
    if (!componentStates.has(componentId)) {
        componentStates.set(componentId, []);
    }
    
    const states = componentStates.get(componentId);
    
    if (!activeComponent._stateIndex) {
        activeComponent._stateIndex = 0;
    }
    
    const currentIndex = activeComponent._stateIndex;

    if (states[currentIndex] === undefined) {
        states[currentIndex] = initial;
    }
    
    function setState(newValue) {
        states[currentIndex] = newValue;
        update();
    }
    
    activeComponent._stateIndex++;
    return [states[currentIndex], setState];
}

function useEffect(callback, dependencies) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    
    activeComponentIds.add(componentId);
    
    if (!componentEffects.has(componentId)) {
        componentEffects.set(componentId, []);
    }
    
    const effects = componentEffects.get(componentId);
    
    if (!activeComponent._effectIndex) {
        activeComponent._effectIndex = 0;
    }
    
    const currentIndex = activeComponent._effectIndex;
    const prevEffect = effects[currentIndex];
    
    let shouldRun = false;
    
    if (!prevEffect) {
        shouldRun = true;
    } else if (!dependencies) {
        shouldRun = true;
    } else if (dependencies.length === 0) {
        shouldRun = false;
    } else {
        shouldRun = dependencies.some((dep, i) => dep !== prevEffect.dependencies[i]);
    }
    
    effects[currentIndex] = {
        callback,
        dependencies: dependencies ? [...dependencies] : null
    };
    
    if (shouldRun) {
        setTimeout(() => {
            callback();
        }, 0);
    }
    
    activeComponent._effectIndex++;
}

function createVNode(type, props, children) {
    return {
        type,
        props: props || {},
        children: children || [],
        key: props?.key
    };
}

function createComponent(fn) {
    return function(...args) {
        const componentId = getComponentId(fn);
        activeComponentIds.add(componentId);
        componentStack.push(fn);
        
        fn._stateIndex = 0;
        fn._effectIndex = 0;
        
        const result = fn(...args);
        componentStack.pop();
        
        return result;
    };
}

function h(tag, props, ...children) {
    const flatChildren = children.flat(Infinity).filter(child => child != null && child !== false);
    
    const normalizedChildren = flatChildren.map(child => {
        if (typeof child === "string" || typeof child === "number") {
            return createVNode("TEXT", { textContent: String(child) }, []);
        } else if (typeof child === "function") {
            return createComponent(child)();
        } else if (child.type) {
            return child;
        } else if (child instanceof Node) {
            return createVNode("DOM_NODE", { node: child }, []);
        }
        return createVNode("TEXT", { textContent: String(child) }, []);
    });
    
    return createVNode(tag, props, normalizedChildren);
}

function createDOMElement(vnode) {
    if (vnode.type === "TEXT") {
        const textNode = document.createTextNode(vnode.props.textContent || "");
        domNodeMap.set(vnode, textNode);
        return textNode;
    }
    
    if (vnode.type === "DOM_NODE") {
        return vnode.props.node;
    }
    
    const element = document.createElement(vnode.type);
    domNodeMap.set(vnode, element);
    
    updateProps(element, {}, vnode.props);
    
    for (const child of vnode.children) {
        element.appendChild(createDOMElement(child));
    }
    
    return element;
}

function updateProps(domElement, oldProps, newProps) {
    for (const key in oldProps) {
        if (!(key in newProps)) {
            if (key.startsWith("on")) {
                domElement[key.toLowerCase()] = null;
            } else if (key === "className") {
                domElement.className = "";
            } else if (key !== "key") {
                domElement.removeAttribute(key);
            }
        }
    }
    
    for (const key in newProps) {
        if (key === "key") continue;
        
        if (oldProps[key] !== newProps[key]) {
            if (key.startsWith("on") && typeof newProps[key] === "function") {
                domElement[key.toLowerCase()] = newProps[key];
            } else if (key === "className") {
                domElement.className = newProps[key];
            } else {
                domElement.setAttribute(key, newProps[key]);
            }
        }
    }
}

function diff(parentDom, oldVNode, newVNode, index = 0) {
    if (!oldVNode && newVNode) {
        const newDom = createDOMElement(newVNode);
        parentDom.appendChild(newDom);
        return;
    }
    
    if (oldVNode && !newVNode) {
        const domNode = domNodeMap.get(oldVNode);
        if (domNode && domNode.parentNode) {
            domNode.parentNode.removeChild(domNode);
        }
        return;
    }
    
    if (oldVNode.type !== newVNode.type) {
        const oldDom = domNodeMap.get(oldVNode);
        const newDom = createDOMElement(newVNode);
        
        if (oldDom && oldDom.parentNode) {
            oldDom.parentNode.replaceChild(newDom, oldDom);
        }
        return;
    }
    
    const domNode = domNodeMap.get(oldVNode);
    domNodeMap.set(newVNode, domNode);
    
    if (newVNode.type === "TEXT") {
        if (oldVNode.props.textContent !== newVNode.props.textContent) {
            domNode.textContent = newVNode.props.textContent;
        }
        return;
    }
    
    if (newVNode.type !== "DOM_NODE") {
        updateProps(domNode, oldVNode.props, newVNode.props);
    }
    
    const oldChildren = oldVNode.children || [];
    const newChildren = newVNode.children || [];
    const maxLength = Math.max(oldChildren.length, newChildren.length);
    
    for (let i = 0; i < maxLength; i++) {
        diff(domNode, oldChildren[i], newChildren[i], i);
    }
}

function update() {
    const previousActiveIds = new Set(activeComponentIds);
    activeComponentIds.clear();
    componentStack = [];
    
    const newVTree = createComponent(component)();
    
    if (oldVTree) {
        diff(root, oldVTree, newVTree);
    } else {
        root.innerHTML = "";
        root.appendChild(createDOMElement(newVTree));
    }
    
    oldVTree = newVTree;
    
    for (const id of previousActiveIds) {
        if (!activeComponentIds.has(id)) {
            componentStates.delete(id);
            componentEffects.delete(id);
        }
    }
}

function render(comp) {
    component = comp;
    activeComponentIds.clear();
    
    const newVTree = createComponent(comp)();
    root.appendChild(createDOMElement(newVTree));
    oldVTree = newVTree;
}

const tags = ["html","head","title","base","link","meta","style","body","header","nav","main","section","article","aside","footer","h1","h2","h3","h4","h5","h6","hgroup","p","hr","pre","blockquote","ol","ul","li","dl","dt","dd","figure","figcaption","div","a","em","strong","small","s","cite","q","dfn","abbr","data","time","code","samp","kbd","sub","sup","i","b","u","mark","ruby","rt","rp","bdi","bdo","span","br","wbr","img","audio","video","track","map","area","picture","embed","object","param","iframe","source","script","noscript","canvas","template","slot","del","ins","table","caption","colgroup","col","thead","tbody","tfoot","tr","th","td","form","fieldset","legend","label","input","button","select","datalist","optgroup","option","textarea","output","details","summary","dialog","menu","menuitem"];

const elements = {};
tags.forEach(tag => {
    elements[tag] = (...args) => {
        let props = {};
        let children = args;

        if (
            args.length > 0 &&
            args[0] != null &&
            typeof args[0] === "object" &&
            !Array.isArray(args[0]) &&
            !(args[0] instanceof Node) &&
            !args[0].type
        ) {
            props = args[0];
            children = args.slice(1);
        }

        return h(tag, props, ...children.flat());
    }
})

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