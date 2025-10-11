// Root DOM element and main component
let root = null;
let component = null;

// Component state management
const componentStates = new Map();
const componentEffects = new Map();
const componentMemos = new Map();
const componentCallbacks = new Map();
const componentIds = new WeakMap();
let nextComponentId = 0;

// Execution context tracking
let componentStack = [];
let activeComponentIds = new Set();

// Context management
const contextStack = [];
let nextContextId = 0;

// Virtual DOM management
let oldVTree = null;
const domNodeMap = new WeakMap();

// Batching system
let updateScheduled = false;
let batchedUpdates = new Set();
const BATCH_DELAY = 0;

// Render loop protection
const MAX_UPDATES_PER_SECOND = 100;
let updateCount = 0;
let lastResetTime = Date.now();

// Debouncing for large trees
let debounceTimer = null;
const DEBOUNCE_DELAY = 16; // ~60fps

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
// Context API Implementation
// ============================================================================

function createContext(defaultValue) {
    const contextId = `context_${nextContextId++}`;
    
    const context = {
        _id: contextId,
        _defaultValue: defaultValue,
        Provider: function({ value, children }) {
            contextStack.push({ id: contextId, value });
            
            if (Array.isArray(children)) {
                return h('div', {}, ...children);
            }
            
            return children;
        },
        Consumer: function({ children }) {
            const value = useContext(context);
            return typeof children === 'function' ? children(value) : children;
        }
    };
    
    return context;
}

function useContext(context) {
    if (!context || !context._id) {
        throw new Error('useContext must be called with a valid context object');
    }
    
    for (let i = contextStack.length - 1; i >= 0; i--) {
        if (contextStack[i].id === context._id) {
            return contextStack[i].value;
        }
    }
    
    return context._defaultValue;
}

// ============================================================================
// Batching and Update Protection
// ============================================================================

function checkRenderLoop() {
    const now = Date.now();
    
    // Reset counter every second
    if (now - lastResetTime > 1000) {
        updateCount = 0;
        lastResetTime = now;
    }
    
    updateCount++;
    
    if (updateCount > MAX_UPDATES_PER_SECOND) {
        console.error('Render loop detected! Too many updates per second.');
        throw new Error('Infinite render loop detected. Check your useEffect dependencies.');
    }
}

function scheduleUpdate(updateFn) {
    batchedUpdates.add(updateFn);
    
    if (!updateScheduled) {
        updateScheduled = true;
        
        // Debounce for large trees
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            Promise.resolve().then(flushUpdates);
        }, BATCH_DELAY);
    }
}

function flushUpdates() {
    if (batchedUpdates.size === 0) {
        updateScheduled = false;
        return;
    }
    
    checkRenderLoop();
    
    const updates = Array.from(batchedUpdates);
    batchedUpdates.clear();
    updateScheduled = false;
    
    // Execute all batched updates
    updates.forEach(fn => fn());
}

// ============================================================================
// React Hooks Implementation
// ============================================================================

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
        const value = typeof newValue === 'function' 
            ? newValue(states[currentIndex]) 
            : newValue;
        
        if (Object.is(states[currentIndex], value)) {
            return; // Skip update if value hasn't changed
        }
        
        states[currentIndex] = value;
        scheduleUpdate(() => update());
    }
    
    activeComponent._stateIndex++;
    return [states[currentIndex], setState];
}

function useReducer(reducer, initialState, init) {
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
        states[currentIndex] = init ? init(initialState) : initialState;
    }
    
    function dispatch(action) {
        const newState = reducer(states[currentIndex], action);
        
        if (Object.is(states[currentIndex], newState)) {
            return;
        }
        
        states[currentIndex] = newState;
        scheduleUpdate(() => update());
    }
    
    activeComponent._stateIndex++;
    return [states[currentIndex], dispatch];
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
    
    const shouldRun = shouldRunEffect(prevEffect, dependencies);
    
    effects[currentIndex] = {
        callback,
        dependencies: dependencies ? [...dependencies] : null,
        cleanup: prevEffect?.cleanup,
        isLayout: false
    };
    
    if (shouldRun) {
        setTimeout(() => {
            // Run cleanup from previous effect
            if (prevEffect?.cleanup) {
                try {
                    prevEffect.cleanup();
                } catch (e) {
                    console.error('Error in effect cleanup:', e);
                }
            }
            
            // Run new effect and store cleanup
            try {
                const cleanup = callback();
                if (typeof cleanup === 'function') {
                    effects[currentIndex].cleanup = cleanup;
                }
            } catch (e) {
                console.error('Error in effect:', e);
            }
        }, 0);
    }
    
    activeComponent._effectIndex++;
}

function useLayoutEffect(callback, dependencies) {
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
    
    const shouldRun = shouldRunEffect(prevEffect, dependencies);
    
    effects[currentIndex] = {
        callback,
        dependencies: dependencies ? [...dependencies] : null,
        cleanup: prevEffect?.cleanup,
        isLayout: true
    };
    
    if (shouldRun) {
        // Synchronous execution
        if (prevEffect?.cleanup) {
            try {
                prevEffect.cleanup();
            } catch (e) {
                console.error('Error in layout effect cleanup:', e);
            }
        }
        
        try {
            const cleanup = callback();
            if (typeof cleanup === 'function') {
                effects[currentIndex].cleanup = cleanup;
            }
        } catch (e) {
            console.error('Error in layout effect:', e);
        }
    }
    
    activeComponent._effectIndex++;
}

function useMemo(factory, dependencies) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    
    activeComponentIds.add(componentId);
    
    if (!componentMemos.has(componentId)) {
        componentMemos.set(componentId, []);
    }
    
    const memos = componentMemos.get(componentId);
    
    if (!activeComponent._memoIndex) {
        activeComponent._memoIndex = 0;
    }
    
    const currentIndex = activeComponent._memoIndex;
    const prevMemo = memos[currentIndex];
    
    // Check if we need to recompute
    const shouldRecompute = !prevMemo || 
        !dependencies || 
        dependencies.some((dep, i) => !Object.is(dep, prevMemo.dependencies[i]));
    
    if (shouldRecompute) {
        const value = factory();
        memos[currentIndex] = {
            value,
            dependencies: dependencies ? [...dependencies] : null
        };
    }
    
    activeComponent._memoIndex++;
    return memos[currentIndex].value;
}

function useCallback(callback, dependencies) {
    return useMemo(() => callback, dependencies);
}

function shouldRunEffect(prevEffect, dependencies) {
    if (!prevEffect) {
        return true;
    }
    
    if (!dependencies) {
        return true;
    }
    
    if (dependencies.length === 0) {
        return false;
    }
    
    return dependencies.some((dep, i) => !Object.is(dep, prevEffect.dependencies[i]));
}

function useRef(initialValue) {
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
        states[currentIndex] = { current: initialValue };
    }
    
    activeComponent._stateIndex++;
    return states[currentIndex];
}

// ============================================================================
// Lifecycle Helpers
// ============================================================================

function onMount(callback) {
    useEffect(() => {
        callback();
    }, []);
}

function onUnmount(callback) {
    useEffect(() => {
        return callback;
    }, []);
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
        
        fn._stateIndex = 0;
        fn._effectIndex = 0;
        fn._memoIndex = 0;
        
        const contextStackLength = contextStack.length;
        
        const result = fn(...args);
        
        contextStack.length = contextStackLength;
        
        componentStack.pop();
        
        return result;
    };
}

function h(tag, props, ...children) {
    const flatChildren = children
        .flat(Infinity)
        .filter(child => child != null && child !== false);
    
    const normalizedChildren = flatChildren.map(child => normalizeChild(child));
    
    return createVNode(tag, props, normalizedChildren);
}

function normalizeChild(child) {
    if (typeof child === "string" || typeof child === "number") {
        return createVNode("TEXT", { textContent: String(child) }, []);
    }
    
    if (typeof child === "function") {
        return createComponent(child)();
    }
    
    if (child.type) {
        return child;
    }
    
    if (child instanceof Node) {
        return createVNode("DOM_NODE", { node: child }, []);
    }
    
    return createVNode("TEXT", { textContent: String(child) }, []);
}

// ============================================================================
// DOM Operations
// ============================================================================

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
        if (key in newProps || key === "key") continue;
        
        if (key.startsWith("on")) {
            domElement[key.toLowerCase()] = null;
        } else if (key === "className") {
            domElement.className = "";
        } else {
            domElement.removeAttribute(key);
        }
    }
    
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
// Keyed Reconciliation (Diffing Algorithm)
// ============================================================================

function diff(parentDom, oldVNode, newVNode, index = 0) {
    if (!oldVNode && newVNode) {
        const newDom = createDOMElement(newVNode);
        parentDom.appendChild(newDom);
        return;
    }
    
    if (oldVNode && !newVNode) {
        const domNode = domNodeMap.get(oldVNode);
        if (domNode?.parentNode) {
            domNode.parentNode.removeChild(domNode);
        }
        return;
    }
    
    if (oldVNode.type !== newVNode.type) {
        const oldDom = domNodeMap.get(oldVNode);
        const newDom = createDOMElement(newVNode);
        
        if (oldDom?.parentNode) {
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
    
    // Keyed diffing for children
    diffChildren(domNode, oldVNode.children || [], newVNode.children || []);
}

function diffChildren(parentDom, oldChildren, newChildren) {
    // Build maps for keyed children
    const oldKeyedChildren = new Map();
    const oldIndexedChildren = [];
    
    oldChildren.forEach((child, index) => {
        if (child.key != null) {
            oldKeyedChildren.set(child.key, { child, index });
        } else {
            oldIndexedChildren.push({ child, index });
        }
    });
    
    let oldIndexPointer = 0;
    
    newChildren.forEach((newChild, newIndex) => {
        let oldChild = null;
        let oldIndex = -1;
        
        // Try to match by key first
        if (newChild.key != null && oldKeyedChildren.has(newChild.key)) {
            const match = oldKeyedChildren.get(newChild.key);
            oldChild = match.child;
            oldIndex = match.index;
            oldKeyedChildren.delete(newChild.key);
        }
        // Fallback to positional matching for non-keyed children
        else if (newChild.key == null && oldIndexPointer < oldIndexedChildren.length) {
            const match = oldIndexedChildren[oldIndexPointer];
            oldChild = match.child;
            oldIndex = match.index;
            oldIndexPointer++;
        }
        
        if (oldChild) {
            // Update existing child
            diff(parentDom, oldChild, newChild, newIndex);
            
            // Move DOM node if position changed
            const currentDom = domNodeMap.get(newChild);
            const expectedDom = parentDom.childNodes[newIndex];
            
            if (currentDom !== expectedDom) {
                parentDom.insertBefore(currentDom, expectedDom || null);
            }
        } else {
            // Insert new child
            const newDom = createDOMElement(newChild);
            const refNode = parentDom.childNodes[newIndex] || null;
            parentDom.insertBefore(newDom, refNode);
        }
    });
    
    // Remove unused keyed children
    oldKeyedChildren.forEach(({ child }) => {
        const domNode = domNodeMap.get(child);
        if (domNode?.parentNode) {
            domNode.parentNode.removeChild(domNode);
        }
    });
    
    // Remove extra indexed children
    for (let i = oldIndexPointer; i < oldIndexedChildren.length; i++) {
        const { child } = oldIndexedChildren[i];
        const domNode = domNodeMap.get(child);
        if (domNode?.parentNode) {
            domNode.parentNode.removeChild(domNode);
        }
    }
}

// ============================================================================
// Component Cleanup
// ============================================================================

function cleanupComponent(componentId) {
    // Run all effect cleanups
    const effects = componentEffects.get(componentId);
    if (effects) {
        effects.forEach(effect => {
            if (effect?.cleanup) {
                try {
                    effect.cleanup();
                } catch (e) {
                    console.error('Error in cleanup:', e);
                }
            }
        });
    }
    
    // Clear component data
    componentStates.delete(componentId);
    componentEffects.delete(componentId);
    componentMemos.delete(componentId);
    componentCallbacks.delete(componentId);
}

// ============================================================================
// Rendering
// ============================================================================

function update() {
    const previousActiveIds = new Set(activeComponentIds);
    activeComponentIds.clear();
    componentStack = [];
    contextStack.length = 0;
    
    const newVTree = createComponent(component)();
    
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
            cleanupComponent(id);
        }
    }
}

function render(comp) {
    component = comp;
    activeComponentIds.clear();
    contextStack.length = 0;
    
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
    "menu", "menuitem", "svg", "path"
];

const elements = {};

HTML_TAGS.forEach(tag => {
    elements[tag] = (...args) => {
        let props = {};
        let children = args;

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

const {
    html, head, title, base, link, meta, style, body, header, nav, main, section,
    article, aside, footer, h1, h2, h3, h4, h5, h6, hgroup, p, hr, pre, blockquote,
    ol, ul, li, dl, dt, dd, figure, figcaption, div, a, em, strong, small, s, cite,
    q, dfn, abbr, data, time, code, samp, kbd, sub, sup, i, b, u, mark, ruby, rt,
    rp, bdi, bdo, span, br, wbr, img, audio, video, track, map, area, picture,
    embed, object, param, iframe, source, script, noscript, canvas, template, slot,
    del, ins, table, caption, colgroup, col, thead, tbody, tfoot, tr, th, td,
    form, fieldset, legend, label, input, button, select, datalist, optgroup,
    option, textarea, output, details, summary, dialog, menu, menuitem, svg, path
} = elements;