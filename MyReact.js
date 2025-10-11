/**
 * MyReact - A lightweight React-like framework
 * Version 1.0.0
 * No JSX, no build step required
 */

// ============================================================================
// Global Configuration
// ============================================================================

let DEBUG_MODE = false;

// ============================================================================
// Root Management
// ============================================================================

let root = null;
let component = null;

// ============================================================================
// Component State Management
// ============================================================================

const componentStates = new Map();
const componentEffects = new Map();
const componentMemos = new Map();
const componentCallbacks = new Map();
const componentIds = new WeakMap();
const componentInstances = new Map();
let nextComponentId = 0;

// ============================================================================
// Execution Context Tracking
// ============================================================================

let componentStack = [];
let activeComponentIds = new Set();
let currentInstanceKey = null;

// ============================================================================
// Context Management
// ============================================================================

const contextStack = [];
let nextContextId = 0;

// ============================================================================
// Virtual DOM Management
// ============================================================================

let oldVTree = null;
const domNodeMap = new WeakMap();

// ============================================================================
// Batching System
// ============================================================================

let updateScheduled = false;
let batchedUpdates = new Set();
const BATCH_DELAY = 0;

// ============================================================================
// Render Loop Protection
// ============================================================================

const MAX_UPDATES_PER_SECOND = 100;
let updateCount = 0;
let lastResetTime = Date.now();

// ============================================================================
// Debouncing for Large Trees
// ============================================================================

let debounceTimer = null;
const DEBOUNCE_DELAY = 16; // ~60fps

// ============================================================================
// Event Delegation System
// ============================================================================

const delegatedEvents = new Set(['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'focus', 'blur']);
let eventDelegationInitialized = false;

function initEventDelegation() {
    if (eventDelegationInitialized) return;
    
    delegatedEvents.forEach(eventType => {
        document.addEventListener(eventType, (e) => {
            let target = e.target;
            
            while (target && target !== document) {
                if (target.__listeners && target.__listeners[eventType]) {
                    target.__listeners[eventType](e);
                    break;
                }
                target = target.parentNode;
            }
        }, true);
    });
    
    eventDelegationInitialized = true;
}

// ============================================================================
// Component ID Management
// ============================================================================

function getComponentId(fn) {
    if (!componentIds.has(fn)) {
        componentIds.set(fn, `comp_${nextComponentId++}`);
    }
    return componentIds.get(fn);
}

function getInstanceKey(componentId, key) {
    return `${componentId}_${key || 'default'}`;
}

// ============================================================================
// Context API Implementation
// ============================================================================

/**
 * Creates a new React-like context
 * @param {*} defaultValue - The default value for the context
 * @returns {Object} Context object with Provider and Consumer
 */
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

/**
 * Hook to consume a context value
 * @param {Object} context - Context object created by createContext
 * @returns {*} The current context value
 */
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
    
    updates.forEach(fn => fn());
}

// ============================================================================
// React Hooks Implementation
// ============================================================================

/**
 * Hook for managing component state
 * @param {*} initial - Initial state value
 * @returns {Array} [state, setState] tuple
 */
function useState(initial) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    const instanceKey = currentInstanceKey;
    
    activeComponentIds.add(instanceKey);
    
    if (!componentStates.has(instanceKey)) {
        componentStates.set(instanceKey, []);
    }
    
    const states = componentStates.get(instanceKey);
    const instance = componentInstances.get(instanceKey);
    
    if (!instance._stateIndex) {
        instance._stateIndex = 0;
    }
    
    const currentIndex = instance._stateIndex;

    if (states[currentIndex] === undefined) {
        states[currentIndex] = initial;
    }
    
    function setState(newValue) {
        if (instance._unmounted) return;
        
        const value = typeof newValue === 'function' 
            ? newValue(states[currentIndex]) 
            : newValue;
        
        if (Object.is(states[currentIndex], value)) {
            return;
        }
        
        states[currentIndex] = value;
        scheduleUpdate(() => update());
    }
    
    instance._stateIndex++;
    return [states[currentIndex], setState];
}

/**
 * Hook for managing state with a reducer
 * @param {Function} reducer - Reducer function
 * @param {*} initialState - Initial state
 * @param {Function} init - Optional initialization function
 * @returns {Array} [state, dispatch] tuple
 */
function useReducer(reducer, initialState, init) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    const instanceKey = currentInstanceKey;
    
    activeComponentIds.add(instanceKey);
    
    if (!componentStates.has(instanceKey)) {
        componentStates.set(instanceKey, []);
    }
    
    const states = componentStates.get(instanceKey);
    const instance = componentInstances.get(instanceKey);
    
    if (!instance._stateIndex) {
        instance._stateIndex = 0;
    }
    
    const currentIndex = instance._stateIndex;

    if (states[currentIndex] === undefined) {
        states[currentIndex] = init ? init(initialState) : initialState;
    }
    
    function dispatch(action) {
        if (instance._unmounted) return;
        
        const newState = reducer(states[currentIndex], action);
        
        if (Object.is(states[currentIndex], newState)) {
            return;
        }
        
        states[currentIndex] = newState;
        scheduleUpdate(() => update());
    }
    
    instance._stateIndex++;
    return [states[currentIndex], dispatch];
}

/**
 * Hook for side effects
 * @param {Function} callback - Effect callback
 * @param {Array} dependencies - Dependency array
 */
function useEffect(callback, dependencies) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    const instanceKey = currentInstanceKey;
    
    activeComponentIds.add(instanceKey);
    
    if (!componentEffects.has(instanceKey)) {
        componentEffects.set(instanceKey, []);
    }
    
    const effects = componentEffects.get(instanceKey);
    const instance = componentInstances.get(instanceKey);
    
    if (!instance._effectIndex) {
        instance._effectIndex = 0;
    }
    
    const currentIndex = instance._effectIndex;
    const prevEffect = effects[currentIndex];
    
    const shouldRun = shouldRunEffect(prevEffect, dependencies);
    
    effects[currentIndex] = {
        callback,
        dependencies: dependencies ? [...dependencies] : null,
        cleanup: prevEffect?.cleanup,
        isLayout: false
    };
    
    if (shouldRun) {
        const timeoutId = setTimeout(() => {
            if (instance._unmounted || !activeComponentIds.has(instanceKey)) {
                return;
            }
            
            if (prevEffect?.cleanup) {
                try {
                    prevEffect.cleanup();
                } catch (e) {
                    if (DEBUG_MODE) {
                        console.error('Error in effect cleanup:', e);
                    }
                }
            }
            
            try {
                const cleanup = callback();
                if (typeof cleanup === 'function') {
                    effects[currentIndex].cleanup = cleanup;
                }
            } catch (e) {
                if (DEBUG_MODE) {
                    console.error('Error in effect:', e);
                }
            }
        }, 0);
        
        if (!instance._timeouts) {
            instance._timeouts = [];
        }
        instance._timeouts.push(timeoutId);
    }
    
    instance._effectIndex++;
}

/**
 * Hook for synchronous layout effects
 * @param {Function} callback - Effect callback
 * @param {Array} dependencies - Dependency array
 */
function useLayoutEffect(callback, dependencies) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    const instanceKey = currentInstanceKey;
    
    activeComponentIds.add(instanceKey);
    
    if (!componentEffects.has(instanceKey)) {
        componentEffects.set(instanceKey, []);
    }
    
    const effects = componentEffects.get(instanceKey);
    const instance = componentInstances.get(instanceKey);
    
    if (!instance._effectIndex) {
        instance._effectIndex = 0;
    }
    
    const currentIndex = instance._effectIndex;
    const prevEffect = effects[currentIndex];
    
    const shouldRun = shouldRunEffect(prevEffect, dependencies);
    
    effects[currentIndex] = {
        callback,
        dependencies: dependencies ? [...dependencies] : null,
        cleanup: prevEffect?.cleanup,
        isLayout: true
    };
    
    if (shouldRun) {
        if (instance._unmounted || !activeComponentIds.has(instanceKey)) {
            return;
        }
        
        if (prevEffect?.cleanup) {
            try {
                prevEffect.cleanup();
            } catch (e) {
                if (DEBUG_MODE) {
                    console.error('Error in layout effect cleanup:', e);
                }
            }
        }
        
        try {
            const cleanup = callback();
            if (typeof cleanup === 'function') {
                effects[currentIndex].cleanup = cleanup;
            }
        } catch (e) {
            if (DEBUG_MODE) {
                console.error('Error in layout effect:', e);
            }
        }
    }
    
    instance._effectIndex++;
}

/**
 * Hook for memoizing expensive computations
 * @param {Function} factory - Factory function
 * @param {Array} dependencies - Dependency array
 * @returns {*} Memoized value
 */
function useMemo(factory, dependencies) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    const instanceKey = currentInstanceKey;
    
    activeComponentIds.add(instanceKey);
    
    if (!componentMemos.has(instanceKey)) {
        componentMemos.set(instanceKey, []);
    }
    
    const memos = componentMemos.get(instanceKey);
    const instance = componentInstances.get(instanceKey);
    
    if (!instance._memoIndex) {
        instance._memoIndex = 0;
    }
    
    const currentIndex = instance._memoIndex;
    const prevMemo = memos[currentIndex];
    
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
    
    instance._memoIndex++;
    return memos[currentIndex].value;
}

/**
 * Hook for memoizing callback functions
 * @param {Function} callback - Callback function
 * @param {Array} dependencies - Dependency array
 * @returns {Function} Memoized callback
 */
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

/**
 * Hook for creating a mutable ref object
 * @param {*} initialValue - Initial ref value
 * @returns {Object} Ref object with current property
 */
function useRef(initialValue) {
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    const instanceKey = currentInstanceKey;
    
    activeComponentIds.add(instanceKey);
    
    if (!componentStates.has(instanceKey)) {
        componentStates.set(instanceKey, []);
    }
    
    const states = componentStates.get(instanceKey);
    const instance = componentInstances.get(instanceKey);
    
    if (!instance._stateIndex) {
        instance._stateIndex = 0;
    }
    
    const currentIndex = instance._stateIndex;

    if (states[currentIndex] === undefined) {
        states[currentIndex] = { current: initialValue };
    }
    
    instance._stateIndex++;
    return states[currentIndex];
}

// ============================================================================
// Lifecycle Helpers
// ============================================================================

/**
 * Helper to run callback on component mount
 * @param {Function} callback - Mount callback
 */
function onMount(callback) {
    useEffect(() => {
        callback();
    }, []);
}

/**
 * Helper to run callback on component unmount
 * @param {Function} callback - Unmount callback
 */
function onUnmount(callback) {
    useEffect(() => {
        return callback;
    }, []);
}

// ============================================================================
// Error Boundary
// ============================================================================

/**
 * Wraps a component with error handling
 * @param {Function} Component - Component to wrap
 * @param {Function} FallbackComponent - Fallback component for errors
 * @returns {Function} Wrapped component
 */
function withErrorBoundary(Component, FallbackComponent) {
    return function(props) {
        try {
            return Component(props);
        } catch (error) {
            if (DEBUG_MODE) {
                console.error('Error in component rendering:', error);
            }
            return FallbackComponent({ error });
        }
    };
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

function createComponent(fn, key) {
    return function(...args) {
        const componentId = getComponentId(fn);
        const instanceKey = getInstanceKey(componentId, key);
        
        if (!componentInstances.has(instanceKey)) {
            componentInstances.set(instanceKey, {
                _stateIndex: 0,
                _effectIndex: 0,
                _memoIndex: 0,
                _unmounted: false,
                _timeouts: []
            });
        }
        
        const instance = componentInstances.get(instanceKey);
        instance._stateIndex = 0;
        instance._effectIndex = 0;
        instance._memoIndex = 0;
        
        activeComponentIds.add(instanceKey);
        componentStack.push(fn);
        
        const previousInstanceKey = currentInstanceKey;
        currentInstanceKey = instanceKey;
        
        const contextStackLength = contextStack.length;
        
        const result = fn(...args);
        
        contextStack.length = contextStackLength;
        
        currentInstanceKey = previousInstanceKey;
        componentStack.pop();
        
        return result;
    };
}

/**
 * Creates a virtual DOM node (hyperscript)
 * @param {string} tag - HTML tag name
 * @param {Object} props - Element properties
 * @param {...*} children - Child elements
 * @returns {Object} Virtual DOM node
 */
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
            const eventName = key.slice(2).toLowerCase();
            
            if (delegatedEvents.has(eventName)) {
                if (domElement.__listeners) {
                    delete domElement.__listeners[eventName];
                }
            } else {
                domElement[key.toLowerCase()] = null;
            }
        } else if (key === "className") {
            domElement.className = "";
        } else {
            domElement.removeAttribute(key);
        }
    }
    
    for (const key in newProps) {
        if (key === "key" || oldProps[key] === newProps[key]) continue;
        
        if (key.startsWith("on") && typeof newProps[key] === "function") {
            const eventName = key.slice(2).toLowerCase();
            
            if (delegatedEvents.has(eventName)) {
                if (!domElement.__listeners) {
                    domElement.__listeners = {};
                }
                domElement.__listeners[eventName] = newProps[key];
            } else {
                domElement[key.toLowerCase()] = newProps[key];
            }
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
    
    diffChildren(domNode, oldVNode.children || [], newVNode.children || []);
}

function diffChildren(parentDom, oldChildren, newChildren) {
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
        
        if (newChild.key != null && oldKeyedChildren.has(newChild.key)) {
            const match = oldKeyedChildren.get(newChild.key);
            oldChild = match.child;
            oldIndex = match.index;
            oldKeyedChildren.delete(newChild.key);
        }
        else if (newChild.key == null && oldIndexPointer < oldIndexedChildren.length) {
            const match = oldIndexedChildren[oldIndexPointer];
            oldChild = match.child;
            oldIndex = match.index;
            oldIndexPointer++;
        }
        
        if (oldChild) {
            diff(parentDom, oldChild, newChild, newIndex);
            
            const currentDom = domNodeMap.get(newChild);
            const expectedDom = parentDom.childNodes[newIndex];
            
            if (currentDom !== expectedDom) {
                parentDom.insertBefore(currentDom, expectedDom || null);
            }
        } else {
            const newDom = createDOMElement(newChild);
            const refNode = parentDom.childNodes[newIndex] || null;
            parentDom.insertBefore(newDom, refNode);
        }
    });
    
    oldKeyedChildren.forEach(({ child }) => {
        const domNode = domNodeMap.get(child);
        if (domNode?.parentNode) {
            domNode.parentNode.removeChild(domNode);
        }
    });
    
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

function cleanupComponent(instanceKey) {
    const instance = componentInstances.get(instanceKey);
    if (!instance) return;
    
    instance._unmounted = true;
    
    if (instance._timeouts) {
        instance._timeouts.forEach(id => clearTimeout(id));
        instance._timeouts = [];
    }
    
    const effects = componentEffects.get(instanceKey);
    if (effects) {
        effects.forEach(effect => {
            if (effect?.cleanup) {
                try {
                    effect.cleanup();
                } catch (e) {
                    if (DEBUG_MODE) {
                        console.error('Error in cleanup:', e);
                    }
                }
            }
        });
    }
    
    componentStates.delete(instanceKey);
    componentEffects.delete(instanceKey);
    componentMemos.delete(instanceKey);
    componentCallbacks.delete(instanceKey);
    componentInstances.delete(instanceKey);
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

/**
 * Creates a root for rendering
 * @param {HTMLElement} container - DOM container element
 * @returns {Object} Root object with render method
 */
function createRoot(container) {
    if (!container || !(container instanceof HTMLElement)) {
        throw new Error('createRoot requires a valid DOM element');
    }
    
    initEventDelegation();
    
    return {
        render(comp) {
            root = container;
            component = comp;
            activeComponentIds.clear();
            contextStack.length = 0;
            
            container.innerHTML = "";
            
            const newVTree = createComponent(comp)();
            container.appendChild(createDOMElement(newVTree));
            oldVTree = newVTree;
        }
    };
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

// ============================================================================
// Version and Global Exports
// ============================================================================

const MyReact = {
    version: "1.0.0",
    createRoot,
    render,
    h,
    useState,
    useReducer,
    useEffect,
    useLayoutEffect,
    useMemo,
    useCallback,
    useRef,
    useContext,
    createContext,
    onMount,
    onUnmount,
    withErrorBoundary,
    DEBUG_MODE,
    setDebugMode: (enabled) => { DEBUG_MODE = enabled; },
    // HTML helpers
    ...elements
};

// Export for browser environment
if (typeof window !== 'undefined') {
    window.MyReact = MyReact;
}