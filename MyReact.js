// Root DOM element and main component
let root = null;
let component = null;

// Component state management
const componentStates = new Map();
const componentEffects = new Map();
const componentIds = new WeakMap();
let nextComponentId = 0;

// Execution context tracking
let componentStack = [];
let activeComponentIds = new Set();

// Virtual DOM management
let oldVTree = null;
const domNodeMap = new WeakMap();

// ============================================================================
// Component ID Management
// ============================================================================

function getComponentId(fn) {
    if (!componentIds.has(fn)) {
        componentIds.set(fn, `comp_${nextComponentId++}`);
    }
    return componentIds.get(fn);
}

// ============================================================================
// React Hooks Implementation
// ============================================================================

function useState(initial) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    
    activeComponentIds.add(componentId);
    
    // Initialize state array for component if needed
    if (!componentStates.has(componentId)) {
        componentStates.set(componentId, []);
    }
    
    const states = componentStates.get(componentId);
    
    // Initialize state index for this render
    if (!activeComponent._stateIndex) {
        activeComponent._stateIndex = 0;
    }
    
    const currentIndex = activeComponent._stateIndex;

    // Set initial value if this is the first render
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
    
    // Initialize effects array for component if needed
    if (!componentEffects.has(componentId)) {
        componentEffects.set(componentId, []);
    }
    
    const effects = componentEffects.get(componentId);
    
    // Initialize effect index for this render
    if (!activeComponent._effectIndex) {
        activeComponent._effectIndex = 0;
    }
    
    const currentIndex = activeComponent._effectIndex;
    const prevEffect = effects[currentIndex];
    
    // Determine if effect should run
    const shouldRun = shouldRunEffect(prevEffect, dependencies);
    
    // Store effect with its dependencies
    effects[currentIndex] = {
        callback,
        dependencies: dependencies ? [...dependencies] : null
    };
    
    // Schedule effect execution
    if (shouldRun) {
        setTimeout(callback, 0);
    }
    
    activeComponent._effectIndex++;
}

function shouldRunEffect(prevEffect, dependencies) {
    // First render - always run
    if (!prevEffect) {
        return true;
    }
    
    // No dependencies - always run
    if (!dependencies) {
        return true;
    }
    
    // Empty dependencies array - run only once
    if (dependencies.length === 0) {
        return false;
    }
    
    // Check if any dependency changed
    return dependencies.some((dep, i) => dep !== prevEffect.dependencies[i]);
}

// ============================================================================
// Virtual DOM Creation
// ============================================================================

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
        
        // Reset hook indices for this render
        fn._stateIndex = 0;
        fn._effectIndex = 0;
        
        const result = fn(...args);
        componentStack.pop();
        
        return result;
    };
}

function h(tag, props, ...children) {
    // Flatten and filter children
    const flatChildren = children
        .flat(Infinity)
        .filter(child => child != null && child !== false);
    
    // Normalize children to VNodes
    const normalizedChildren = flatChildren.map(child => normalizeChild(child));
    
    return createVNode(tag, props, normalizedChildren);
}

function normalizeChild(child) {
    // String or number - convert to text node
    if (typeof child === "string" || typeof child === "number") {
        return createVNode("TEXT", { textContent: String(child) }, []);
    }
    
    // Function component - execute it
    if (typeof child === "function") {
        return createComponent(child)();
    }
    
    // Already a VNode
    if (child.type) {
        return child;
    }
    
    // DOM Node - wrap it
    if (child instanceof Node) {
        return createVNode("DOM_NODE", { node: child }, []);
    }
    
    // Fallback - convert to text
    return createVNode("TEXT", { textContent: String(child) }, []);
}

// ============================================================================
// DOM Operations
// ============================================================================

function createDOMElement(vnode) {
    // Text node
    if (vnode.type === "TEXT") {
        const textNode = document.createTextNode(vnode.props.textContent || "");
        domNodeMap.set(vnode, textNode);
        return textNode;
    }
    
    // Existing DOM node
    if (vnode.type === "DOM_NODE") {
        return vnode.props.node;
    }
    
    // Regular element
    const element = document.createElement(vnode.type);
    domNodeMap.set(vnode, element);
    
    // Apply props
    updateProps(element, {}, vnode.props);
    
    // Append children
    for (const child of vnode.children) {
        element.appendChild(createDOMElement(child));
    }
    
    return element;
}

function updateProps(domElement, oldProps, newProps) {
    // Remove old props
    for (const key in oldProps) {
        if (key in newProps || key === "key") continue;
        
        if (key.startsWith("on")) {
            domElement[key.toLowerCase()] = null;
        } else if (key === "className") {
            domElement.className = "";
        } else {
            domElement.removeAttribute(key);
        }
    }
    
    // Add/update new props
    for (const key in newProps) {
        if (key === "key" || oldProps[key] === newProps[key]) continue;
        
        if (key.startsWith("on") && typeof newProps[key] === "function") {
            domElement[key.toLowerCase()] = newProps[key];
        } else if (key === "className") {
            domElement.className = newProps[key];
        } else {
            domElement.setAttribute(key, newProps[key]);
        }
    }
}

// ============================================================================
// Reconciliation (Diffing Algorithm)
// ============================================================================

function diff(parentDom, oldVNode, newVNode, index = 0) {
    // New node added
    if (!oldVNode && newVNode) {
        const newDom = createDOMElement(newVNode);
        parentDom.appendChild(newDom);
        return;
    }
    
    // Node removed
    if (oldVNode && !newVNode) {
        const domNode = domNodeMap.get(oldVNode);
        if (domNode?.parentNode) {
            domNode.parentNode.removeChild(domNode);
        }
        return;
    }
    
    // Node type changed - replace
    if (oldVNode.type !== newVNode.type) {
        const oldDom = domNodeMap.get(oldVNode);
        const newDom = createDOMElement(newVNode);
        
        if (oldDom?.parentNode) {
            oldDom.parentNode.replaceChild(newDom, oldDom);
        }
        return;
    }
    
    // Same type - update existing node
    const domNode = domNodeMap.get(oldVNode);
    domNodeMap.set(newVNode, domNode);
    
    // Update text content
    if (newVNode.type === "TEXT") {
        if (oldVNode.props.textContent !== newVNode.props.textContent) {
            domNode.textContent = newVNode.props.textContent;
        }
        return;
    }
    
    // Update props for regular elements
    if (newVNode.type !== "DOM_NODE") {
        updateProps(domNode, oldVNode.props, newVNode.props);
    }
    
    // Recursively diff children
    const oldChildren = oldVNode.children || [];
    const newChildren = newVNode.children || [];
    const maxLength = Math.max(oldChildren.length, newChildren.length);
    
    for (let i = 0; i < maxLength; i++) {
        diff(domNode, oldChildren[i], newChildren[i], i);
    }
}

// ============================================================================
// Rendering
// ============================================================================

function update() {
    const previousActiveIds = new Set(activeComponentIds);
    activeComponentIds.clear();
    componentStack = [];
    
    // Create new virtual tree
    const newVTree = createComponent(component)();
    
    // Diff and update DOM
    if (oldVTree) {
        diff(root, oldVTree, newVTree);
    } else {
        root.innerHTML = "";
        root.appendChild(createDOMElement(newVTree));
    }
    
    oldVTree = newVTree;
    
    // Cleanup unmounted components
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

// ============================================================================
// HTML Element Helpers
// ============================================================================

const HTML_TAGS = [
    "html", "head", "title", "base", "link", "meta", "style", "body", "header",
    "nav", "main", "section", "article", "aside", "footer", "h1", "h2", "h3",
    "h4", "h5", "h6", "hgroup", "p", "hr", "pre", "blockquote", "ol", "ul",
    "li", "dl", "dt", "dd", "figure", "figcaption", "div", "a", "em", "strong",
    "small", "s", "cite", "q", "dfn", "abbr", "data", "time", "code", "samp",
    "kbd", "sub", "sup", "i", "b", "u", "mark", "ruby", "rt", "rp", "bdi",
    "bdo", "span", "br", "wbr", "img", "audio", "video", "track", "map", "area",
    "picture", "embed", "object", "param", "iframe", "source", "script",
    "noscript", "canvas", "template", "slot", "del", "ins", "table", "caption",
    "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td", "form",
    "fieldset", "legend", "label", "input", "button", "select", "datalist",
    "optgroup", "option", "textarea", "output", "details", "summary", "dialog",
    "menu", "menuitem"
];

const elements = {};

HTML_TAGS.forEach(tag => {
    elements[tag] = (...args) => {
        let props = {};
        let children = args;

        // First argument is props object if it's a plain object
        const isPropsObject = args.length > 0 &&
            args[0] != null &&
            typeof args[0] === "object" &&
            !Array.isArray(args[0]) &&
            !(args[0] instanceof Node) &&
            !args[0].type;

        if (isPropsObject) {
            props = args[0];
            children = args.slice(1);
        }

        return h(tag, props, ...children.flat());
    };
});

// Export all HTML element helpers
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