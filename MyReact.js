let root = null;
let component;

// Mappa che associa ogni componente ai suoi stati
let componentStates = new Map();
let componentEffects = new Map();
let componentStack = [];
let componentIds = new WeakMap();
let nextComponentId = 0;
let activeComponentIds = new Set();

// Virtual DOM
let oldVTree = null;
let domNodeMap = new WeakMap(); // Mappa VNode → DOM reale

// ============= STYLING SYSTEM =============

let styleCounter = 0;
const styleSheet = new Map();
const utilityCache = new Map();

// Inizializza il foglio di stile
function initStyleSheet() {
    if (!document.getElementById('my-react-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'my-react-styles';
        document.head.appendChild(styleEl);
    }
}

// Inietta CSS nel documento
function injectStyle(cssString) {
    initStyleSheet();
    const styleEl = document.getElementById('my-react-styles');
    styleEl.textContent += cssString + '\n';
}

// ============= 1. CSS-IN-JS (styled components) =============

function css(strings, ...values) {
    const cssString = strings.reduce((acc, str, i) => {
        return acc + str + (values[i] || '');
    }, '');
    
    if (styleSheet.has(cssString)) {
        return styleSheet.get(cssString);
    }
    
    const className = `css-${styleCounter++}`;
    injectStyle(`.${className} { ${cssString} }`);
    
    styleSheet.set(cssString, className);
    return className;
}

// Crea componenti styled
function styled(tag) {
    return (strings, ...values) => {
        return (props = {}, ...children) => {
            const className = css(strings, ...values);
            const existingClass = props.class || props.className || '';
            const combinedClass = existingClass ? `${existingClass} ${className}` : className;
            
            return h(tag, { ...props, class: combinedClass }, ...children);
        };
    };
}

// ============= 2. UTILITY CLASSES =============

const utilityStyles = {
    // Display
    'block': 'display: block',
    'inline-block': 'display: inline-block',
    'inline': 'display: inline',
    'flex': 'display: flex',
    'inline-flex': 'display: inline-flex',
    'grid': 'display: grid',
    'hidden': 'display: none',
    
    // Flex Direction
    'flex-row': 'flex-direction: row',
    'flex-col': 'flex-direction: column',
    'flex-row-reverse': 'flex-direction: row-reverse',
    'flex-col-reverse': 'flex-direction: column-reverse',
    
    // Flex Wrap
    'flex-wrap': 'flex-wrap: wrap',
    'flex-nowrap': 'flex-wrap: nowrap',
    
    // Justify Content
    'justify-start': 'justify-content: flex-start',
    'justify-end': 'justify-content: flex-end',
    'justify-center': 'justify-content: center',
    'justify-between': 'justify-content: space-between',
    'justify-around': 'justify-content: space-around',
    'justify-evenly': 'justify-content: space-evenly',
    
    // Align Items
    'items-start': 'align-items: flex-start',
    'items-end': 'align-items: flex-end',
    'items-center': 'align-items: center',
    'items-baseline': 'align-items: baseline',
    'items-stretch': 'align-items: stretch',
    
    // Gap
    'gap-1': 'gap: 0.25rem',
    'gap-2': 'gap: 0.5rem',
    'gap-3': 'gap: 0.75rem',
    'gap-4': 'gap: 1rem',
    'gap-5': 'gap: 1.25rem',
    'gap-6': 'gap: 1.5rem',
    'gap-8': 'gap: 2rem',
    
    // Padding
    'p-0': 'padding: 0',
    'p-1': 'padding: 0.25rem',
    'p-2': 'padding: 0.5rem',
    'p-3': 'padding: 0.75rem',
    'p-4': 'padding: 1rem',
    'p-5': 'padding: 1.25rem',
    'p-6': 'padding: 1.5rem',
    'p-8': 'padding: 2rem',
    
    'px-2': 'padding-left: 0.5rem; padding-right: 0.5rem',
    'px-4': 'padding-left: 1rem; padding-right: 1rem',
    'px-6': 'padding-left: 1.5rem; padding-right: 1.5rem',
    
    'py-2': 'padding-top: 0.5rem; padding-bottom: 0.5rem',
    'py-4': 'padding-top: 1rem; padding-bottom: 1rem',
    'py-6': 'padding-top: 1.5rem; padding-bottom: 1.5rem',
    
    // Margin
    'm-0': 'margin: 0',
    'm-1': 'margin: 0.25rem',
    'm-2': 'margin: 0.5rem',
    'm-3': 'margin: 0.75rem',
    'm-4': 'margin: 1rem',
    'm-auto': 'margin: auto',
    
    'mx-auto': 'margin-left: auto; margin-right: auto',
    'my-4': 'margin-top: 1rem; margin-bottom: 1rem',
    
    // Width
    'w-full': 'width: 100%',
    'w-1/2': 'width: 50%',
    'w-1/3': 'width: 33.333333%',
    'w-2/3': 'width: 66.666667%',
    'w-1/4': 'width: 25%',
    'w-auto': 'width: auto',
    
    // Height
    'h-full': 'height: 100%',
    'h-screen': 'height: 100vh',
    'h-auto': 'height: auto',
    
    // Colors - Text
    'text-white': 'color: #ffffff',
    'text-black': 'color: #000000',
    'text-gray-300': 'color: #d1d5db',
    'text-gray-500': 'color: #6b7280',
    'text-gray-700': 'color: #374151',
    'text-gray-900': 'color: #111827',
    'text-red-500': 'color: #ef4444',
    'text-blue-500': 'color: #3b82f6',
    'text-green-500': 'color: #10b981',
    'text-yellow-500': 'color: #f59e0b',
    'text-purple-500': 'color: #a855f7',
    
    // Colors - Background
    'bg-white': 'background-color: #ffffff',
    'bg-black': 'background-color: #000000',
    'bg-gray-50': 'background-color: #f9fafb',
    'bg-gray-100': 'background-color: #f3f4f6',
    'bg-gray-200': 'background-color: #e5e7eb',
    'bg-gray-800': 'background-color: #1f2937',
    'bg-gray-900': 'background-color: #111827',
    'bg-red-500': 'background-color: #ef4444',
    'bg-blue-500': 'background-color: #3b82f6',
    'bg-green-500': 'background-color: #10b981',
    'bg-transparent': 'background-color: transparent',
    
    // Border Radius
    'rounded': 'border-radius: 0.25rem',
    'rounded-md': 'border-radius: 0.375rem',
    'rounded-lg': 'border-radius: 0.5rem',
    'rounded-xl': 'border-radius: 0.75rem',
    'rounded-full': 'border-radius: 9999px',
    
    // Border
    'border': 'border-width: 1px; border-style: solid',
    'border-2': 'border-width: 2px; border-style: solid',
    'border-gray-300': 'border-color: #d1d5db',
    'border-gray-700': 'border-color: #374151',
    
    // Font Size
    'text-xs': 'font-size: 0.75rem',
    'text-sm': 'font-size: 0.875rem',
    'text-base': 'font-size: 1rem',
    'text-lg': 'font-size: 1.125rem',
    'text-xl': 'font-size: 1.25rem',
    'text-2xl': 'font-size: 1.5rem',
    'text-3xl': 'font-size: 1.875rem',
    'text-4xl': 'font-size: 2.25rem',
    
    // Font Weight
    'font-normal': 'font-weight: 400',
    'font-medium': 'font-weight: 500',
    'font-semibold': 'font-weight: 600',
    'font-bold': 'font-weight: 700',
    
    // Text Align
    'text-left': 'text-align: left',
    'text-center': 'text-align: center',
    'text-right': 'text-align: right',
    
    // Shadow
    'shadow': 'box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    'shadow-md': 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    'shadow-lg': 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    
    // Cursor
    'cursor-pointer': 'cursor: pointer',
    'cursor-default': 'cursor: default',
    
    // Position
    'relative': 'position: relative',
    'absolute': 'position: absolute',
    'fixed': 'position: fixed',
    'sticky': 'position: sticky',
};

// Processa le utility classes
function processUtilityClasses(className) {
    if (typeof className !== 'string') return className;
    
    const classes = className.split(' ').filter(c => c.trim());
    const processedClasses = [];
    
    classes.forEach(cls => {
        if (utilityStyles[cls]) {
            if (!utilityCache.has(cls)) {
                const utilityClass = `u-${cls}`;
                injectStyle(`.${utilityClass} { ${utilityStyles[cls]} }`);
                utilityCache.set(cls, utilityClass);
            }
            processedClasses.push(utilityCache.get(cls));
        } else {
            processedClasses.push(cls);
        }
    });
    
    return processedClasses.join(' ');
}

// ============= 3. INLINE STYLES (oggetti JS) =============

function styleObjectToString(styleObj) {
    return Object.entries(styleObj)
        .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
        })
        .join('; ');
}

// ============= HOOKS =============

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

// Hook useStyle
function useStyle(styleObject) {
    const [className] = useState(() => {
        const cls = `dynamic-${styleCounter++}`;
        const cssString = styleObjectToString(styleObject);
        injectStyle(`.${cls} { ${cssString} }`);
        return cls;
    });
    
    return className;
}

// ============= VIRTUAL DOM =============

// Virtual Node
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

// Converte elementi in VNodes
function h(tag, props, ...children) {
    const flatChildren = children.flat(Infinity).filter(child => child != null && child !== false);
    
    const normalizedChildren = flatChildren.map(child => {
        if (typeof child === "string" || typeof child === "number") {
            return createVNode("TEXT", { textContent: String(child) }, []);
        } else if (typeof child === "function") {
            return createComponent(child)();
        } else if (child.type) {
            // È già un VNode
            return child;
        } else if (child instanceof Node) {
            // Nodo DOM esistente - wrappalo
            return createVNode("DOM_NODE", { node: child }, []);
        }
        return createVNode("TEXT", { textContent: String(child) }, []);
    });
    
    return createVNode(tag, props, normalizedChildren);
}

// Crea un elemento DOM reale da un VNode
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
    
    // Applica props
    updateProps(element, {}, vnode.props);
    
    // Aggiungi children
    for (const child of vnode.children) {
        element.appendChild(createDOMElement(child));
    }
    
    return element;
}

// Aggiorna le props di un elemento (VERSIONE MIGLIORATA CON STYLING)
function updateProps(domElement, oldProps, newProps) {
    // Rimuovi vecchie props
    for (const key in oldProps) {
        if (!(key in newProps)) {
            if (key.startsWith("on")) {
                domElement[key.toLowerCase()] = null;
            } else if (key === "style") {
                domElement.style.cssText = "";
            } else if (key === "class" || key === "className") {
                domElement.className = "";
            } else if (key !== "key") {
                domElement.removeAttribute(key);
            }
        }
    }
    
    // Aggiungi/aggiorna nuove props
    for (const key in newProps) {
        if (key === "key") continue;
        
        if (oldProps[key] !== newProps[key]) {
            // Gestione style object
            if (key === "style" && typeof newProps[key] === "object") {
                Object.assign(domElement.style, newProps[key]);
            }
            // Gestione classi (con utility classes)
            else if (key === "class" || key === "className") {
                domElement.className = processUtilityClasses(newProps[key]);
            }
            // Event handlers
            else if (key.startsWith("on") && typeof newProps[key] === "function") {
                domElement[key.toLowerCase()] = newProps[key];
            }
            // Attributi normali
            else {
                domElement.setAttribute(key, newProps[key]);
            }
        }
    }
}

// Diffing algorithm
function diff(parentDom, oldVNode, newVNode, index = 0) {
    // Caso 1: Nuovo nodo aggiunto
    if (!oldVNode && newVNode) {
        const newDom = createDOMElement(newVNode);
        parentDom.appendChild(newDom);
        return;
    }
    
    // Caso 2: Nodo rimosso
    if (oldVNode && !newVNode) {
        const domNode = domNodeMap.get(oldVNode);
        if (domNode && domNode.parentNode) {
            domNode.parentNode.removeChild(domNode);
        }
        return;
    }
    
    // Caso 3: Tipo di nodo cambiato
    if (oldVNode.type !== newVNode.type) {
        const oldDom = domNodeMap.get(oldVNode);
        const newDom = createDOMElement(newVNode);
        
        if (oldDom && oldDom.parentNode) {
            oldDom.parentNode.replaceChild(newDom, oldDom);
        }
        return;
    }
    
    // Caso 4: Stesso tipo - aggiorna
    const domNode = domNodeMap.get(oldVNode);
    domNodeMap.set(newVNode, domNode);
    
    // Aggiorna text content
    if (newVNode.type === "TEXT") {
        if (oldVNode.props.textContent !== newVNode.props.textContent) {
            domNode.textContent = newVNode.props.textContent;
        }
        return;
    }
    
    // Aggiorna props
    if (newVNode.type !== "DOM_NODE") {
        updateProps(domNode, oldVNode.props, newVNode.props);
    }
    
    // Diffing dei children
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
    
    // Crea nuovo virtual tree
    const newVTree = createComponent(component)();
    
    // Applica il diff
    if (oldVTree) {
        diff(root, oldVTree, newVTree);
    } else {
        // Primo render
        root.innerHTML = "";
        root.appendChild(createDOMElement(newVTree));
    }
    
    oldVTree = newVTree;
    
    // Cleanup componenti inattivi
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

// ============= TAG FACTORY =============

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
            !args[0].type // Non è un VNode
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