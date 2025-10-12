/**
 * MyReact - A Production-Ready React-like Framework
 * Version 2.0.0
 * No JSX, no build step required
 */

// ============================================================================
// Configuration & Environment
// ============================================================================

const IS_PRODUCTION = typeof process !== 'undefined' && 
                      process.env?.NODE_ENV === 'production';
const IS_BROWSER = typeof window !== 'undefined';

let CONFIG = {
    mode: IS_PRODUCTION ? 'production' : 'development',
    performance: {
        maxUpdatesPerSecond: 100,
        debounceDelay: 16,
        batchDelay: 0,
        enableProfiling: !IS_PRODUCTION
    },
    debug: {
        enabled: !IS_PRODUCTION,
        logRenders: false,
        trackComponentTree: false,
        warnOnSlowRenders: true,
        slowRenderThreshold: 16
    },
    features: {
        strictMode: true,
        suspense: true,
        portals: true
    }
};

function configure(userConfig) {
    CONFIG = { ...CONFIG, ...userConfig };
    DEBUG_MODE = CONFIG.debug.enabled;
}

let DEBUG_MODE = CONFIG.debug.enabled;

// ============================================================================
// Performance Metrics
// ============================================================================

const performanceMetrics = {
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    slowRenders: [],
    componentRenderTimes: new Map(),
    
    recordRender(duration, componentName) {
        this.renderCount++;
        this.totalRenderTime += duration;
        this.averageRenderTime = this.totalRenderTime / this.renderCount;
        
        if (componentName) {
            if (!this.componentRenderTimes.has(componentName)) {
                this.componentRenderTimes.set(componentName, {
                    count: 0,
                    totalTime: 0,
                    avgTime: 0
                });
            }
            const stats = this.componentRenderTimes.get(componentName);
            stats.count++;
            stats.totalTime += duration;
            stats.avgTime = stats.totalTime / stats.count;
        }
        
        if (duration > CONFIG.debug.slowRenderThreshold) {
            this.slowRenders.push({
                duration,
                componentName,
                timestamp: Date.now(),
                stack: new Error().stack
            });
            
            if (CONFIG.debug.warnOnSlowRenders) {
                console.warn(`Slow render detected: ${duration.toFixed(2)}ms`, componentName);
            }
        }
        
        if (this.slowRenders.length > 100) {
            this.slowRenders.shift();
        }
    },
    
    getReport() {
        return {
            totalRenders: this.renderCount,
            averageRenderTime: this.averageRenderTime.toFixed(2) + 'ms',
            slowRenders: this.slowRenders.length,
            componentStats: Array.from(this.componentRenderTimes.entries())
                .map(([name, stats]) => ({
                    component: name,
                    renders: stats.count,
                    avgTime: stats.avgTime.toFixed(2) + 'ms'
                }))
                .sort((a, b) => parseFloat(b.avgTime) - parseFloat(a.avgTime))
        };
    },
    
    reset() {
        this.renderCount = 0;
        this.totalRenderTime = 0;
        this.averageRenderTime = 0;
        this.slowRenders = [];
        this.componentRenderTimes.clear();
    }
};

// ============================================================================
// PropTypes Validation
// ============================================================================

const PropTypes = {
    string: (val) => typeof val === 'string',
    number: (val) => typeof val === 'number',
    bool: (val) => typeof val === 'boolean',
    func: (val) => typeof val === 'function',
    array: (val) => Array.isArray(val),
    object: (val) => typeof val === 'object' && val !== null,
    node: (val) => val == null || typeof val === 'string' || 
                   typeof val === 'number' || val.type,
    element: (val) => val && val.type,
    any: () => true,
    
    arrayOf: (validator) => (val) => 
        Array.isArray(val) && val.every(validator),
    
    objectOf: (validator) => (val) => 
        typeof val === 'object' && val !== null && 
        Object.values(val).every(validator),
    
    oneOf: (values) => (val) => values.includes(val),
    
    oneOfType: (validators) => (val) => 
        validators.some(validator => validator(val)),
    
    shape: (shape) => (val) => {
        if (typeof val !== 'object' || val === null) return false;
        return Object.keys(shape).every(key => 
            shape[key](val[key])
        );
    },
    
    required: (validator) => {
        const fn = (val) => val != null && validator(val);
        fn.isRequired = true;
        return fn;
    }
};

function validateProps(component, props) {
    if (!component.propTypes || !DEBUG_MODE) return;
    
    const componentName = component.name || 'Component';
    
    Object.keys(component.propTypes).forEach(key => {
        const validator = component.propTypes[key];
        const value = props[key];
        
        if (validator.isRequired && value == null) {
            console.error(
                `Required prop '${key}' was not specified in '${componentName}'.`
            );
            return;
        }
        
        if (value != null && !validator(value)) {
            console.error(
                `Invalid prop '${key}' of value '${value}' supplied to '${componentName}'.`
            );
        }
    });
}

// ============================================================================
// Root Management
// ============================================================================

let root = null;
let component = null;
let rootVersion = 0;

// ============================================================================
// Component State Management
// ============================================================================

const componentStates = new Map();
const componentEffects = new Map();
const componentMemos = new Map();
const componentCallbacks = new Map();
const componentIds = new WeakMap();
const componentInstances = new Map();
const componentNames = new WeakMap();
let nextComponentId = 0;

// ============================================================================
// Execution Context Tracking
// ============================================================================

let componentStack = [];
let activeComponentIds = new Set();
let currentInstanceKey = null;
let isInRender = false;
let hookCallOrder = [];

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
const vnodeToDom = new WeakMap();
const domToVnode = new WeakMap();

// ============================================================================
// Batching System
// ============================================================================

let updateScheduled = false;
let batchedUpdates = new Set();
const BATCH_DELAY = CONFIG.performance.batchDelay;

// ============================================================================
// Render Loop Protection
// ============================================================================

const MAX_UPDATES_PER_SECOND = CONFIG.performance.maxUpdatesPerSecond;
let updateCount = 0;
let lastResetTime = Date.now();
let renderVersion = 0;

// ============================================================================
// Debouncing for Large Trees
// ============================================================================

let debounceTimer = null;
const DEBOUNCE_DELAY = CONFIG.performance.debounceDelay;

// ============================================================================
// Event Delegation System
// ============================================================================

const delegatedEvents = new Set([
    'click', 'dblclick', 'input', 'change', 'submit', 
    'keydown', 'keyup', 'keypress', 'focus', 'blur',
    'mousedown', 'mouseup', 'mousemove', 'mouseenter', 'mouseleave',
    'touchstart', 'touchend', 'touchmove'
]);
let eventDelegationInitialized = false;
const globalEventListeners = new Map();

function initEventDelegation() {
    if (eventDelegationInitialized) return;
    
    delegatedEvents.forEach(eventType => {
        const handler = (e) => {
            let target = e.target;
            
            while (target && target !== document) {
                if (target.__listeners && target.__listeners[eventType]) {
                    target.__listeners[eventType](e);
                    if (e.cancelBubble) break;
                }
                target = target.parentNode;
            }
        };
        
        document.addEventListener(eventType, handler, true);
        globalEventListeners.set(eventType, handler);
    });
    
    eventDelegationInitialized = true;
}

function cleanupEventDelegation() {
    globalEventListeners.forEach((handler, eventType) => {
        document.removeEventListener(eventType, handler, true);
    });
    globalEventListeners.clear();
    eventDelegationInitialized = false;
}

// ============================================================================
// Memory Management
// ============================================================================

const elementListeners = new WeakMap();

function trackElementListener(element, eventType, handler) {
    if (!elementListeners.has(element)) {
        elementListeners.set(element, new Map());
    }
    const listeners = elementListeners.get(element);
    listeners.set(eventType, handler);
}

function cleanupDOMElement(element) {
    if (!element) return;
    
    if (element.__listeners) {
        Object.keys(element.__listeners).forEach(event => {
            delete element.__listeners[event];
        });
        delete element.__listeners;
    }
    
    Array.from(element.children || []).forEach(cleanupDOMElement);
}

// ============================================================================
// Error Handling
// ============================================================================

class MyReactError extends Error {
    constructor(message, component) {
        super(message);
        this.name = 'MyReactError';
        this.component = component;
    }
}

let errorBoundaryStack = [];

function captureError(error, component) {
    const componentName = component?.name || 'Unknown';
    
    console.error(`Error in component ${componentName}:`, error);
    
    for (let i = errorBoundaryStack.length - 1; i >= 0; i--) {
        const boundary = errorBoundaryStack[i];
        if (boundary.onError) {
            boundary.onError(error, { componentName });
            return true;
        }
    }
    
    return false;
}

if (IS_BROWSER) {
    window.addEventListener('error', (event) => {
        if (DEBUG_MODE) {
            console.error('Global error caught:', event.error);
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        if (DEBUG_MODE) {
            console.error('Unhandled promise rejection:', event.reason);
        }
    });
}

// ============================================================================
// Component ID Management
// ============================================================================

function getComponentId(fn) {
    if (!componentIds.has(fn)) {
        componentIds.set(fn, `comp_${nextComponentId++}`);
        if (fn.name) {
            componentNames.set(fn, fn.name);
        }
    }
    return componentIds.get(fn);
}

function getComponentName(fn) {
    return componentNames.get(fn) || fn.name || 'Anonymous';
}

function getInstanceKey(componentId, key) {
    return `${componentId}_${key || 'default'}`;
}

// ============================================================================
// Context API Implementation
// ============================================================================

function createContext(defaultValue) {
    const contextId = `context_${nextContextId++}`;
    
    const context = {
        _id: contextId,
        _defaultValue: defaultValue,
        _currentValue: defaultValue,
        
        Provider: function({ value, children }) {
            const oldValue = context._currentValue;
            context._currentValue = value;
            contextStack.push({ id: contextId, value });
            
            useLayoutEffect(() => {
                return () => {
                    context._currentValue = oldValue;
                    const idx = contextStack.findIndex(c => c.id === contextId && c.value === value);
                    if (idx !== -1) {
                        contextStack.splice(idx, 1);
                    }
                };
            }, [value]);
            
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
    validateHookCall('useContext');
    
    if (!context || !context._id) {
        throw new MyReactError('useContext must be called with a valid context object');
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
        const error = new MyReactError(
            'Infinite render loop detected. Check your useEffect dependencies.'
        );
        console.error('Render loop detected! Too many updates per second.');
        throw error;
    }
}

function scheduleUpdate(updateFn) {
    const currentVersion = ++renderVersion;
    
    batchedUpdates.add(() => {
        if (renderVersion === currentVersion || 
            renderVersion === currentVersion + batchedUpdates.size - 1) {
            updateFn();
        }
    });
    
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
    
    try {
        checkRenderLoop();
        
        const updates = Array.from(batchedUpdates);
        batchedUpdates.clear();
        updateScheduled = false;
        
        updates.forEach(fn => {
            try {
                fn();
            } catch (error) {
                if (!captureError(error)) {
                    throw error;
                }
            }
        });
    } catch (error) {
        batchedUpdates.clear();
        updateScheduled = false;
        throw error;
    }
}

// ============================================================================
// Hook Validation
// ============================================================================

function validateHookCall(hookName) {
    if (!isInRender) {
        throw new MyReactError(
            `${hookName} can only be called inside a component function`
        );
    }
    
    if (CONFIG.features.strictMode) {
        hookCallOrder.push(hookName);
    }
}

function resetHookValidation() {
    hookCallOrder = [];
}

// ============================================================================
// React Hooks Implementation
// ============================================================================

function useState(initial) {
    validateHookCall('useState');
    
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
        states[currentIndex] = typeof initial === 'function' ? initial() : initial;
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

function useReducer(reducer, initialState, init) {
    validateHookCall('useReducer');
    
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
        
        try {
            const newState = reducer(states[currentIndex], action);
            
            if (Object.is(states[currentIndex], newState)) {
                return;
            }
            
            states[currentIndex] = newState;
            scheduleUpdate(() => update());
        } catch (error) {
            captureError(error, activeComponent);
        }
    }
    
    instance._stateIndex++;
    return [states[currentIndex], dispatch];
}

function useEffect(callback, dependencies) {
    validateHookCall('useEffect');
    
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
                } catch (error) {
                    if (DEBUG_MODE) {
                        console.error('Error in effect cleanup:', error);
                    }
                    captureError(error, activeComponent);
                }
            }
            
            try {
                const cleanup = callback();
                if (typeof cleanup === 'function') {
                    effects[currentIndex].cleanup = cleanup;
                }
            } catch (error) {
                if (DEBUG_MODE) {
                    console.error('Error in effect:', error);
                }
                captureError(error, activeComponent);
            }
        }, 0);
        
        if (!instance._timeouts) {
            instance._timeouts = [];
        }
        instance._timeouts.push(timeoutId);
    }
    
    instance._effectIndex++;
}

function useLayoutEffect(callback, dependencies) {
    validateHookCall('useLayoutEffect');
    
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
            } catch (error) {
                if (DEBUG_MODE) {
                    console.error('Error in layout effect cleanup:', error);
                }
                captureError(error, activeComponent);
            }
        }
        
        try {
            const cleanup = callback();
            if (typeof cleanup === 'function') {
                effects[currentIndex].cleanup = cleanup;
            }
        } catch (error) {
            if (DEBUG_MODE) {
                console.error('Error in layout effect:', error);
            }
            captureError(error, activeComponent);
        }
    }
    
    instance._effectIndex++;
}

function useMemo(factory, dependencies) {
    validateHookCall('useMemo');
    
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
        try {
            const value = factory();
            memos[currentIndex] = {
                value,
                dependencies: dependencies ? [...dependencies] : null
            };
        } catch (error) {
            captureError(error, activeComponent);
            throw error;
        }
    }
    
    instance._memoIndex++;
    return memos[currentIndex].value;
}

function useCallback(callback, dependencies) {
    validateHookCall('useCallback');
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
    validateHookCall('useRef');
    
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
// Suspense Implementation
// ============================================================================

const suspenseCache = new WeakMap();

function Suspense({ fallback, children }) {
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    if (error) {
        throw error;
    }
    
    try {
        const result = typeof children === 'function' ? children() : children;
        if (isLoading) {
            setIsLoading(false);
        }
        return result;
    } catch (thrown) {
        if (thrown instanceof Promise) {
            if (!isLoading) {
                setIsLoading(true);
            }
            
            thrown
                .then(() => {
                    setIsLoading(false);
                    scheduleUpdate(() => update());
                })
                .catch(err => {
                    setError(err);
                });
            
            return fallback;
        }
        throw thrown;
    }
}

function lazy(loader) {
    let Component = null;
    let loadingPromise = null;
    let error = null;
    
    return function LazyComponent(props) {
        if (error) {
            throw error;
        }
        
        if (Component) {
            return Component(props);
        }
        
        if (!loadingPromise) {
            loadingPromise = loader()
                .then(module => {
                    Component = module.default || module;
                    return Component;
                })
                .catch(err => {
                    error = err;
                    throw err;
                });
        }
        
        throw loadingPromise;
    };
}

// ============================================================================
// Portal Implementation
// ============================================================================

function createPortal(children, container) {
    if (!container || !(container instanceof HTMLElement)) {
        throw new MyReactError('createPortal requires a valid DOM element');
    }
    
    const portalId = useRef(`portal_${Math.random().toString(36).substr(2, 9)}`);
    const mountedRef = useRef(false);
    
    useLayoutEffect(() => {
        mountedRef.current = true;
        
        const renderPortalContent = () => {
            if (!mountedRef.current) return;
            
            const vnode = typeof children === 'function' 
                ? createComponent(children)() 
                : normalizeChild(children);
            
            const dom = createDOMElement(vnode);
            dom.setAttribute('data-portal-id', portalId.current);
            
            const existingPortal = container.querySelector(
                `[data-portal-id="${portalId.current}"]`
            );
            
            if (existingPortal) {
                container.replaceChild(dom, existingPortal);
            } else {
                container.appendChild(dom);
            }
        };
        
        renderPortalContent();
        
        return () => {
            mountedRef.current = false;
            const portalElement = container.querySelector(
                `[data-portal-id="${portalId.current}"]`
            );
            if (portalElement) {
                cleanupDOMElement(portalElement);
                container.removeChild(portalElement);
            }
        };
    }, [children, container]);
    
    return null;
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
// Error Boundary
// ============================================================================

function withErrorBoundary(Component, FallbackComponent) {
    return function ErrorBoundary(props) {
        const [error, setError] = useState(null);
        const [errorInfo, setErrorInfo] = useState(null);
        
        const boundary = {
            onError: (err, info) => {
                setError(err);
                setErrorInfo(info);
            }
        };
        
        useLayoutEffect(() => {
            errorBoundaryStack.push(boundary);
            return () => {
                const idx = errorBoundaryStack.indexOf(boundary);
                if (idx !== -1) {
                    errorBoundaryStack.splice(idx, 1);
                }
            };
        }, []);
        
        if (error) {
            return FallbackComponent({ error, errorInfo, resetError: () => {
                setError(null);
                setErrorInfo(null);
            }});
        }
        
        try {
            return Component(props);
        } catch (err) {
            setError(err);
            setErrorInfo({ componentName: Component.name });
            return FallbackComponent({ 
                error: err, 
                errorInfo: { componentName: Component.name },
                resetError: () => {
                    setError(null);
                    setErrorInfo(null);
                }
            });
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
        const startTime = CONFIG.performance.enableProfiling ? performance.now() : 0;
        
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
        
        const wasInRender = isInRender;
        isInRender = true;
        resetHookValidation();
        
        let result;
        try {
            validateProps(fn, args[0]);
            result = fn(...args);
        } catch (error) {
            if (!captureError(error, fn)) {
                throw error;
            }
            result = h('div', {}, 'Error rendering component');
        } finally {
            contextStack.length = contextStackLength;
            currentInstanceKey = previousInstanceKey;
            componentStack.pop();
            isInRender = wasInRender;
            
            if (CONFIG.performance.enableProfiling) {
                const duration = performance.now() - startTime;
                performanceMetrics.recordRender(duration, getComponentName(fn));
            }
        }
        
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
    
    if (child && child.type) {
        return child;
    }
    
    if (IS_BROWSER && child instanceof Node) {
        return createVNode("DOM_NODE", { node: child }, []);
    }
    
    return createVNode("TEXT", { textContent: String(child) }, []);
}

// ============================================================================
// DOM Operations with Memory Management
// ============================================================================

function createDOMElement(vnode) {
    if (vnode.type === "TEXT") {
        const textNode = document.createTextNode(vnode.props.textContent || "");
        vnodeToDom.set(vnode, textNode);
        domToVnode.set(textNode, vnode);
        return textNode;
    }
    
    if (vnode.type === "DOM_NODE") {
        return vnode.props.node;
    }
    
    const element = document.createElement(vnode.type);
    vnodeToDom.set(vnode, element);
    domToVnode.set(element, vnode);
    
    updateProps(element, {}, vnode.props);
    
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
        } else if (key === "style" && typeof oldProps[key] === "object") {
            Object.keys(oldProps[key]).forEach(styleProp => {
                domElement.style[styleProp] = "";
            });
        } else if (key === "ref") {
            if (typeof oldProps[key] === "function") {
                oldProps[key](null);
            } else if (oldProps[key] && typeof oldProps[key] === "object") {
                oldProps[key].current = null;
            }
        } else {
            domElement.removeAttribute(key);
        }
    }
    
    // Add/update new props
    for (const key in newProps) {
        if (key === "key" || oldProps[key] === newProps[key]) continue;
        
        if (key.startsWith("on") && typeof newProps[key] === "function") {
            const eventName = key.slice(2).toLowerCase();
            
            if (delegatedEvents.has(eventName)) {
                if (!domElement.__listeners) {
                    domElement.__listeners = {};
                }
                domElement.__listeners[eventName] = newProps[key];
                trackElementListener(domElement, eventName, newProps[key]);
            } else {
                domElement[key.toLowerCase()] = newProps[key];
            }
        } else if (key === "className") {
            domElement.className = newProps[key];
        } else if (key === "style") {
            if (typeof newProps[key] === "object") {
                Object.assign(domElement.style, newProps[key]);
            } else {
                domElement.style.cssText = newProps[key];
            }
        } else if (key === "ref") {
            if (typeof newProps[key] === "function") {
                newProps[key](domElement);
            } else if (newProps[key] && typeof newProps[key] === "object") {
                newProps[key].current = domElement;
            }
        } else if (key === "dangerouslySetInnerHTML") {
            domElement.innerHTML = newProps[key].__html;
        } else if (key in domElement && key !== "list") {
            domElement[key] = newProps[key];
        } else {
            domElement.setAttribute(key, newProps[key]);
        }
    }
}

// ============================================================================
// Optimized Keyed Reconciliation (Diffing Algorithm)
// ============================================================================

function diff(parentDom, oldVNode, newVNode, index = 0) {
    // Case 1: New node added
    if (!oldVNode && newVNode) {
        const newDom = createDOMElement(newVNode);
        if (parentDom) {
            parentDom.appendChild(newDom);
        }
        return newDom;
    }
    
    // Case 2: Node removed
    if (oldVNode && !newVNode) {
        const domNode = vnodeToDom.get(oldVNode);
        if (domNode?.parentNode) {
            cleanupDOMElement(domNode);
            domNode.parentNode.removeChild(domNode);
        }
        vnodeToDom.delete(oldVNode);
        return null;
    }
    
    // Case 3: Node type changed
    if (oldVNode.type !== newVNode.type) {
        const oldDom = vnodeToDom.get(oldVNode);
        const newDom = createDOMElement(newVNode);
        
        if (oldDom?.parentNode) {
            cleanupDOMElement(oldDom);
            oldDom.parentNode.replaceChild(newDom, oldDom);
        }
        
        vnodeToDom.delete(oldVNode);
        return newDom;
    }
    
    // Case 4: Same type, update existing node
    const domNode = vnodeToDom.get(oldVNode);
    vnodeToDom.set(newVNode, domNode);
    domToVnode.set(domNode, newVNode);
    
    if (newVNode.type === "TEXT") {
        if (oldVNode.props.textContent !== newVNode.props.textContent) {
            domNode.textContent = newVNode.props.textContent;
        }
        return domNode;
    }
    
    if (newVNode.type !== "DOM_NODE") {
        updateProps(domNode, oldVNode.props, newVNode.props);
    }
    
    diffChildren(domNode, oldVNode.children || [], newVNode.children || []);
    
    return domNode;
}

function diffChildren(parentDom, oldChildren, newChildren) {
    // Build maps for efficient lookups
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
    const nodesToMove = [];
    
    // First pass: match and create/update nodes
    newChildren.forEach((newChild, newIndex) => {
        let oldChild = null;
        let shouldMove = false;
        
        if (newChild.key != null && oldKeyedChildren.has(newChild.key)) {
            const match = oldKeyedChildren.get(newChild.key);
            oldChild = match.child;
            shouldMove = match.index !== newIndex;
            oldKeyedChildren.delete(newChild.key);
        } else if (newChild.key == null && oldIndexPointer < oldIndexedChildren.length) {
            const match = oldIndexedChildren[oldIndexPointer];
            oldChild = match.child;
            oldIndexPointer++;
        }
        
        if (oldChild) {
            diff(parentDom, oldChild, newChild, newIndex);
            
            if (shouldMove) {
                nodesToMove.push({ vnode: newChild, index: newIndex });
            }
        } else {
            const newDom = createDOMElement(newChild);
            const refNode = parentDom.childNodes[newIndex] || null;
            parentDom.insertBefore(newDom, refNode);
        }
    });
    
    // Second pass: move nodes that need repositioning
    nodesToMove.forEach(({ vnode, index }) => {
        const currentDom = vnodeToDom.get(vnode);
        const expectedDom = parentDom.childNodes[index];
        
        if (currentDom !== expectedDom) {
            parentDom.insertBefore(currentDom, expectedDom || null);
        }
    });
    
    // Third pass: remove unused nodes
    oldKeyedChildren.forEach(({ child }) => {
        const domNode = vnodeToDom.get(child);
        if (domNode?.parentNode) {
            cleanupDOMElement(domNode);
            domNode.parentNode.removeChild(domNode);
        }
        vnodeToDom.delete(child);
    });
    
    for (let i = oldIndexPointer; i < oldIndexedChildren.length; i++) {
        const { child } = oldIndexedChildren[i];
        const domNode = vnodeToDom.get(child);
        if (domNode?.parentNode) {
            cleanupDOMElement(domNode);
            domNode.parentNode.removeChild(domNode);
        }
        vnodeToDom.delete(child);
    }
}

// ============================================================================
// Component Cleanup with Memory Management
// ============================================================================

function cleanupComponent(instanceKey) {
    const instance = componentInstances.get(instanceKey);
    if (!instance) return;
    
    instance._unmounted = true;
    
    // Clear timeouts
    if (instance._timeouts) {
        instance._timeouts.forEach(id => clearTimeout(id));
        instance._timeouts = [];
    }
    
    // Run effect cleanups
    const effects = componentEffects.get(instanceKey);
    if (effects) {
        effects.forEach(effect => {
            if (effect?.cleanup) {
                try {
                    effect.cleanup();
                } catch (error) {
                    if (DEBUG_MODE) {
                        console.error('Error in cleanup:', error);
                    }
                }
            }
        });
    }
    
    // Clear all component data
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
    if (!root || !component) return;
    
    const startTime = CONFIG.performance.enableProfiling ? performance.now() : 0;
    
    try {
        const previousActiveIds = new Set(activeComponentIds);
        activeComponentIds.clear();
        componentStack = [];
        contextStack.length = 0;
        
        const newVTree = createComponent(component)();
        
        if (oldVTree) {
            diff(root, oldVTree, newVTree);
        } else {
            root.innerHTML = "";
            const dom = createDOMElement(newVTree);
            if (dom) {
                root.appendChild(dom);
            }
        }
        
        oldVTree = newVTree;
        
        // Cleanup unmounted components
        for (const id of previousActiveIds) {
            if (!activeComponentIds.has(id)) {
                cleanupComponent(id);
            }
        }
        
        if (CONFIG.performance.enableProfiling) {
            const duration = performance.now() - startTime;
            performanceMetrics.recordRender(duration, 'Root');
        }
    } catch (error) {
        console.error('Error during update:', error);
        if (!captureError(error)) {
            throw error;
        }
    }
}

function render(comp) {
    component = comp;
    activeComponentIds.clear();
    contextStack.length = 0;
    
    try {
        const newVTree = createComponent(comp)();
        const dom = createDOMElement(newVTree);
        if (dom) {
            root.appendChild(dom);
        }
        oldVTree = newVTree;
    } catch (error) {
        console.error('Error during initial render:', error);
        if (!captureError(error)) {
            throw error;
        }
    }
}

// ============================================================================
// Root Creation
// ============================================================================

function createRoot(container) {
    if (!container || !(container instanceof HTMLElement)) {
        throw new MyReactError('createRoot requires a valid DOM element');
    }
    
    initEventDelegation();
    
    const rootInstance = {
        _container: container,
        _version: ++rootVersion,
        
        render(comp) {
            root = container;
            component = comp;
            activeComponentIds.clear();
            contextStack.length = 0;
            
            try {
                container.innerHTML = "";
                
                const newVTree = createComponent(comp)();
                const dom = createDOMElement(newVTree);
                if (dom) {
                    container.appendChild(dom);
                }
                oldVTree = newVTree;
            } catch (error) {
                console.error('Error during render:', error);
                if (!captureError(error)) {
                    throw error;
                }
            }
        },
        
        unmount() {
            if (!root) return;
            
            // Cleanup all components
            activeComponentIds.forEach(id => cleanupComponent(id));
            
            // Cleanup DOM
            cleanupDOMElement(container);
            container.innerHTML = "";
            
            // Reset state
            root = null;
            component = null;
            oldVTree = null;
            activeComponentIds.clear();
            contextStack.length = 0;
            
            // Clear all maps
            componentStates.clear();
            componentEffects.clear();
            componentMemos.clear();
            componentCallbacks.clear();
            componentInstances.clear();
        }
    };
    
    return rootInstance;
}

// ============================================================================
// SSR Support - Hydration
// ============================================================================

function hydrateRoot(container, comp) {
    if (!container || !(container instanceof HTMLElement)) {
        throw new MyReactError('hydrateRoot requires a valid DOM element');
    }
    
    initEventDelegation();
    
    root = container;
    component = comp;
    activeComponentIds.clear();
    contextStack.length = 0;
    
    try {
        // Build virtual tree from existing DOM
        if (container.firstChild) {
            oldVTree = buildVTreeFromDOM(container.firstChild);
        }
        
        // Render component and attach
        const newVTree = createComponent(comp)();
        
        if (oldVTree) {
            diff(container, oldVTree, newVTree);
        } else {
            const dom = createDOMElement(newVTree);
            if (dom) {
                container.appendChild(dom);
            }
        }
        
        oldVTree = newVTree;
        
        return {
            unmount() {
                activeComponentIds.forEach(id => cleanupComponent(id));
                cleanupDOMElement(container);
                container.innerHTML = "";
                root = null;
                component = null;
                oldVTree = null;
            }
        };
    } catch (error) {
        console.error('Error during hydration:', error);
        if (!captureError(error)) {
            throw error;
        }
    }
}

function buildVTreeFromDOM(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        return createVNode('TEXT', { 
            textContent: node.textContent 
        }, []);
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }
    
    const props = {};
    Array.from(node.attributes || []).forEach(attr => {
        if (attr.name === 'class') {
            props.className = attr.value;
        } else {
            props[attr.name] = attr.value;
        }
    });
    
    const children = Array.from(node.childNodes)
        .map(buildVTreeFromDOM)
        .filter(Boolean);
    
    const vnode = createVNode(
        node.tagName.toLowerCase(), 
        props, 
        children
    );
    
    vnodeToDom.set(vnode, node);
    domToVnode.set(node, vnode);
    
    return vnode;
}

// ============================================================================
// DevTools Integration
// ============================================================================

const devTools = {
    version: "2.0.0",
    renderers: new Map(),
    componentTree: null,
    
    init() {
        if (!IS_BROWSER || !DEBUG_MODE) return;
        
        window.__MYREACT_DEVTOOLS__ = this;
        
        // Listen for devtools messages
        window.addEventListener('message', (event) => {
            if (event.data?.source === 'myreact-devtools') {
                this.handleDevToolsMessage(event.data);
            }
        });
    },
    
    handleDevToolsMessage(message) {
        switch (message.type) {
            case 'GET_COMPONENT_TREE':
                this.sendComponentTree();
                break;
            case 'GET_PERFORMANCE':
                this.sendPerformanceData();
                break;
            case 'INSPECT_COMPONENT':
                this.inspectComponent(message.instanceKey);
                break;
        }
    },
    
    sendComponentTree() {
        const tree = this.buildComponentTree();
        window.postMessage({
            source: 'myreact-devtools-response',
            type: 'COMPONENT_TREE',
            data: tree
        }, '*');
    },
    
    sendPerformanceData() {
        window.postMessage({
            source: 'myreact-devtools-response',
            type: 'PERFORMANCE_DATA',
            data: performanceMetrics.getReport()
        }, '*');
    },
    
    buildComponentTree() {
        const tree = [];
        
        componentInstances.forEach((instance, key) => {
            const states = componentStates.get(key);
            const effects = componentEffects.get(key);
            
            tree.push({
                key,
                unmounted: instance._unmounted,
                stateCount: states?.length || 0,
                effectCount: effects?.length || 0,
                states: states || []
            });
        });
        
        return tree;
    },
    
    inspectComponent(instanceKey) {
        const instance = componentInstances.get(instanceKey);
        const states = componentStates.get(instanceKey);
        const effects = componentEffects.get(instanceKey);
        const memos = componentMemos.get(instanceKey);
        
        window.postMessage({
            source: 'myreact-devtools-response',
            type: 'COMPONENT_DETAILS',
            data: {
                instanceKey,
                instance,
                states,
                effects: effects?.map(e => ({
                    hasCleanup: !!e.cleanup,
                    dependencies: e.dependencies,
                    isLayout: e.isLayout
                })),
                memos: memos?.map(m => ({
                    dependencies: m.dependencies
                }))
            }
        }, '*');
    }
};

if (IS_BROWSER && DEBUG_MODE) {
    devTools.init();
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
    "menu", "menuitem", "svg", "path", "circle", "rect", "line", "polyline",
    "polygon", "ellipse", "g", "text", "tspan", "defs", "use", "symbol"
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
            !(IS_BROWSER && args[0] instanceof Node) &&
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
// Fragment Component
// ============================================================================

function Fragment({ children }) {
    return children;
}

// ============================================================================
// Memo Component (Performance Optimization)
// ============================================================================

function memo(Component, arePropsEqual) {
    const memoizedComponent = function(props) {
        const previousProps = useRef(null);
        const previousResult = useRef(null);
        
        const shouldUpdate = !previousProps.current || 
            (arePropsEqual 
                ? !arePropsEqual(previousProps.current, props)
                : !shallowEqual(previousProps.current, props)
            );
        
        if (shouldUpdate) {
            previousProps.current = props;
            previousResult.current = Component(props);
        }
        
        return previousResult.current;
    };
    
    memoizedComponent.displayName = `Memo(${Component.displayName || Component.name})`;
    return memoizedComponent;
}

function shallowEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    if (obj1 === null || obj2 === null) return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    return keys1.every(key => obj1[key] === obj2[key]);
}

// ============================================================================
// Utility Functions
// ============================================================================

function forceUpdate() {
    scheduleUpdate(() => update());
}

function unmountComponentAtNode(container) {
    if (!container) return false;
    
    cleanupDOMElement(container);
    container.innerHTML = "";
    
    activeComponentIds.forEach(id => cleanupComponent(id));
    activeComponentIds.clear();
    
    if (root === container) {
        root = null;
        component = null;
        oldVTree = null;
    }
    
    return true;
}

// ============================================================================
// Additional Hooks - useImperativeHandle
// ============================================================================

function useImperativeHandle(ref, createHandle, deps) {
    validateHookCall('useImperativeHandle');
    
    useLayoutEffect(() => {
        if (typeof ref === 'function') {
            ref(createHandle());
            return () => ref(null);
        } else if (ref && typeof ref === 'object') {
            ref.current = createHandle();
            return () => {
                ref.current = null;
            };
        }
    }, deps);
}

// ============================================================================
// Additional Hooks - useDebugValue
// ============================================================================

function useDebugValue(value, format) {
    validateHookCall('useDebugValue');
    
    if (!DEBUG_MODE) return;
    
    const formattedValue = format ? format(value) : value;
    
    if (devTools && devTools.recordDebugValue) {
        const activeComponent = componentStack[componentStack.length - 1];
        const componentName = getComponentName(activeComponent);
        devTools.recordDebugValue(componentName, formattedValue);
    }
}

// ============================================================================
// Additional Hooks - useId
// ============================================================================

let idCounter = 0;

function useId() {
    validateHookCall('useId');
    
    const activeComponent = componentStack[componentStack.length - 1];
    const componentId = getComponentId(activeComponent);
    const instanceKey = currentInstanceKey;
    
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
        states[currentIndex] = `myreact-${++idCounter}`;
    }
    
    instance._stateIndex++;
    return states[currentIndex];
}

// ============================================================================
// Additional Hooks - useTransition (Simplified)
// ============================================================================

function useTransition() {
    validateHookCall('useTransition');
    
    const [isPending, setIsPending] = useState(false);
    
    const startTransition = useCallback((callback) => {
        setIsPending(true);
        
        // Use lower priority for transition updates
        setTimeout(() => {
            try {
                callback();
            } finally {
                setIsPending(false);
            }
        }, 0);
    }, []);
    
    return [isPending, startTransition];
}

// ============================================================================
// Additional Hooks - useDeferredValue
// ============================================================================

function useDeferredValue(value) {
    validateHookCall('useDeferredValue');
    
    const [deferredValue, setDeferredValue] = useState(value);
    
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDeferredValue(value);
        }, 0);
        
        return () => clearTimeout(timeoutId);
    }, [value]);
    
    return deferredValue;
}

// ============================================================================
// Additional Hooks - useSyncExternalStore
// ============================================================================

function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    validateHookCall('useSyncExternalStore');
    
    const value = getSnapshot();
    const [{ inst }, forceUpdate] = useState({ inst: { value, getSnapshot } });
    
    useLayoutEffect(() => {
        inst.value = value;
        inst.getSnapshot = getSnapshot;
        
        if (checkIfSnapshotChanged(inst)) {
            forceUpdate({ inst });
        }
    }, [subscribe, value, getSnapshot]);
    
    useEffect(() => {
        if (checkIfSnapshotChanged(inst)) {
            forceUpdate({ inst });
        }
        
        const handleStoreChange = () => {
            if (checkIfSnapshotChanged(inst)) {
                forceUpdate({ inst });
            }
        };
        
        return subscribe(handleStoreChange);
    }, [subscribe]);
    
    return value;
}

function checkIfSnapshotChanged(inst) {
    const latestGetSnapshot = inst.getSnapshot;
    const prevValue = inst.value;
    try {
        const nextValue = latestGetSnapshot();
        return !Object.is(prevValue, nextValue);
    } catch (error) {
        return true;
    }
}

// ============================================================================
// Batch Updates API
// ============================================================================

function batchUpdates(callback) {
    const previousBatchState = updateScheduled;
    
    try {
        callback();
    } finally {
        if (!previousBatchState && batchedUpdates.size > 0) {
            flushUpdates();
        }
    }
}

function flushSync(callback) {
    const previousBatchedUpdates = new Set(batchedUpdates);
    batchedUpdates.clear();
    
    try {
        callback();
        flushUpdates();
    } finally {
        previousBatchedUpdates.forEach(update => batchedUpdates.add(update));
    }
}

// ============================================================================
// StrictMode Component
// ============================================================================

function StrictMode({ children }) {
    if (!DEBUG_MODE) {
        return children;
    }
    
    // In strict mode, components are rendered twice to detect side effects
    const [renderCount, setRenderCount] = useState(0);
    
    useEffect(() => {
        if (renderCount === 0) {
            setRenderCount(1);
        }
    }, [renderCount]);
    
    if (CONFIG.features.strictMode && renderCount < 1) {
        // First render - just to detect issues
        try {
            if (typeof children === 'function') {
                children();
            }
        } catch (error) {
            console.warn('StrictMode detected an issue:', error);
        }
    }
    
    return children;
}

// ============================================================================
// Profiler Component
// ============================================================================

function Profiler({ id, onRender, children }) {
    const mountTime = useRef(Date.now());
    const renderStartTime = useRef(0);
    
    useLayoutEffect(() => {
        renderStartTime.current = performance.now();
    });
    
    useEffect(() => {
        const renderDuration = performance.now() - renderStartTime.current;
        const phase = mountTime.current === Date.now() ? 'mount' : 'update';
        
        if (onRender) {
            onRender(id, phase, renderDuration);
        }
    });
    
    return children;
}

// ============================================================================
// cloneElement
// ============================================================================

function cloneElement(element, props, ...children) {
    if (!element || !element.type) {
        throw new MyReactError('cloneElement requires a valid element');
    }
    
    const mergedProps = { ...element.props, ...props };
    const newChildren = children.length > 0 ? children : element.children;
    
    return createVNode(element.type, mergedProps, newChildren);
}

// ============================================================================
// isValidElement
// ============================================================================

function isValidElement(object) {
    return (
        typeof object === 'object' &&
        object !== null &&
        object.type !== undefined
    );
}

// ============================================================================
// Children Utilities
// ============================================================================

const Children = {
    map(children, fn) {
        if (children == null) return children;
        
        const childArray = Array.isArray(children) ? children : [children];
        return childArray.map((child, index) => fn(child, index));
    },
    
    forEach(children, fn) {
        if (children == null) return;
        
        const childArray = Array.isArray(children) ? children : [children];
        childArray.forEach((child, index) => fn(child, index));
    },
    
    count(children) {
        if (children == null) return 0;
        return Array.isArray(children) ? children.length : 1;
    },
    
    only(children) {
        if (!isValidElement(children)) {
            throw new MyReactError('Children.only expected to receive a single element');
        }
        return children;
    },
    
    toArray(children) {
        if (children == null) return [];
        return Array.isArray(children) ? children : [children];
    }
};

// ============================================================================
// forwardRef
// ============================================================================

function forwardRef(render) {
    const forwardRefComponent = function(props) {
        const { ref, ...restProps } = props;
        return render(restProps, ref);
    };
    
    forwardRefComponent.displayName = `ForwardRef(${render.displayName || render.name})`;
    return forwardRefComponent;
}

// ============================================================================
// createRef
// ============================================================================

function createRef() {
    return { current: null };
}

// ============================================================================
// Advanced Error Boundary with ErrorInfo
// ============================================================================

function createErrorBoundary(FallbackComponent) {
    return function ErrorBoundary({ children, onError, onReset }) {
        const [error, setError] = useState(null);
        const [errorInfo, setErrorInfo] = useState(null);
        const [errorCount, setErrorCount] = useState(0);
        
        const boundary = {
            onError: (err, info) => {
                setError(err);
                setErrorInfo(info);
                setErrorCount(c => c + 1);
                
                if (onError) {
                    onError(err, info);
                }
            }
        };
        
        useLayoutEffect(() => {
            errorBoundaryStack.push(boundary);
            return () => {
                const idx = errorBoundaryStack.indexOf(boundary);
                if (idx !== -1) {
                    errorBoundaryStack.splice(idx, 1);
                }
            };
        }, []);
        
        const resetError = useCallback(() => {
            setError(null);
            setErrorInfo(null);
            if (onReset) {
                onReset();
            }
        }, [onReset]);
        
        if (error) {
            return FallbackComponent({ 
                error, 
                errorInfo, 
                resetError,
                errorCount
            });
        }
        
        try {
            return children;
        } catch (err) {
            boundary.onError(err, { componentStack: componentStack.map(c => c.name).join(' > ') });
            return FallbackComponent({ 
                error: err, 
                errorInfo: { componentStack: componentStack.map(c => c.name).join(' > ') },
                resetError,
                errorCount: errorCount + 1
            });
        }
    };
}

// ============================================================================
// Development Warnings
// ============================================================================

const devWarnings = {
    warnedKeys: new Set(),
    
    warnOnce(key, message) {
        if (!DEBUG_MODE || this.warnedKeys.has(key)) return;
        this.warnedKeys.add(key);
        console.warn(`[MyReact Warning]: ${message}`);
    },
    
    checkKeyUsage(children) {
        if (!DEBUG_MODE || !Array.isArray(children)) return;
        
        const keys = new Set();
        let hasKeyWarning = false;
        
        children.forEach((child, index) => {
            if (!child || !child.type) return;
            
            const key = child.key;
            
            if (key == null && children.length > 1) {
                if (!hasKeyWarning) {
                    this.warnOnce(`missing-keys-${index}`, 
                        'Each child in a list should have a unique "key" prop.'
                    );
                    hasKeyWarning = true;
                }
            } else if (key != null && keys.has(key)) {
                this.warnOnce(`duplicate-key-${key}`, 
                    `Encountered two children with the same key: "${key}". Keys should be unique.`
                );
            }
            
            if (key != null) {
                keys.add(key);
            }
        });
    },
    
    checkPropTypes(component, props) {
        if (!DEBUG_MODE || !component.propTypes) return;
        validateProps(component, props);
    }
};

// ============================================================================
// Testing Utilities
// ============================================================================

const TestUtils = {
    act(callback) {
        const result = callback();
        
        if (result instanceof Promise) {
            return result.then(() => {
                flushUpdates();
                return new Promise(resolve => setTimeout(resolve, 0));
            });
        }
        
        flushUpdates();
        return new Promise(resolve => setTimeout(resolve, 0));
    },
    
    mockComponent(name) {
        const mock = function(props) {
            return h('div', { 'data-testid': name }, props.children);
        };
        mock.displayName = name;
        return mock;
    },
    
    findByTestId(container, testId) {
        return container.querySelector(`[data-testid="${testId}"]`);
    },
    
    findAllByTestId(container, testId) {
        return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`));
    }
};

// ============================================================================
// Server-Side Rendering
// ============================================================================

function renderToString(element) {
    if (element == null || element === false) {
        return '';
    }
    
    if (typeof element === 'string' || typeof element === 'number') {
        return escapeHtml(String(element));
    }
    
    if (element.type === 'TEXT') {
        return escapeHtml(element.props.textContent || '');
    }
    
    if (typeof element.type === 'function') {
        const result = element.type(element.props);
        return renderToString(result);
    }
    
    const { type, props, children } = element;
    const attributes = Object.keys(props || {})
        .filter(key => key !== 'key' && key !== 'ref' && key !== 'children')
        .map(key => {
            if (key === 'className') {
                return `class="${escapeHtml(props[key])}"`;
            }
            if (key === 'style' && typeof props[key] === 'object') {
                const styleStr = Object.keys(props[key])
                    .map(k => `${kebabCase(k)}:${props[key][k]}`)
                    .join(';');
                return `style="${styleStr}"`;
            }
            if (key.startsWith('on')) {
                return ''; // Skip event handlers in SSR
            }
            return `${key}="${escapeHtml(String(props[key]))}"`;
        })
        .filter(Boolean)
        .join(' ');
    
    const openTag = attributes ? `<${type} ${attributes}>` : `<${type}>`;
    
    const voidElements = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);
    
    if (voidElements.has(type)) {
        return openTag.replace('>', ' />');
    }
    
    const childrenHtml = (children || [])
        .map(child => renderToString(child))
        .join('');
    
    return `${openTag}${childrenHtml}</${type}>`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

function kebabCase(str) {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

// ============================================================================
// Performance Optimization - Concurrent Features
// ============================================================================

const scheduler = {
    tasks: [],
    isScheduled: false,
    deadline: null,
    
    scheduleTask(callback, priority = 'normal') {
        const task = {
            callback,
            priority,
            timestamp: Date.now()
        };
        
        this.tasks.push(task);
        this.tasks.sort((a, b) => {
            const priorityMap = { high: 3, normal: 2, low: 1 };
            return (priorityMap[b.priority] || 2) - (priorityMap[a.priority] || 2);
        });
        
        if (!this.isScheduled) {
            this.isScheduled = true;
            requestIdleCallback((deadline) => this.processTasks(deadline));
        }
    },
    
    processTasks(deadline) {
        this.deadline = deadline;
        
        while (this.tasks.length > 0 && deadline.timeRemaining() > 0) {
            const task = this.tasks.shift();
            try {
                task.callback();
            } catch (error) {
                console.error('Error in scheduled task:', error);
            }
        }
        
        if (this.tasks.length > 0) {
            requestIdleCallback((deadline) => this.processTasks(deadline));
        } else {
            this.isScheduled = false;
        }
    }
};

if (IS_BROWSER && !window.requestIdleCallback) {
    window.requestIdleCallback = function(callback) {
        const start = Date.now();
        return setTimeout(() => {
            callback({
                didTimeout: false,
                timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
            });
        }, 1);
    };
}

// ============================================================================
// Public API & Exports
// ============================================================================

const MyReact = {
    // Version
    version: "2.0.0",
    
    // Core rendering
    createRoot,
    hydrateRoot,
    render,
    h,
    Fragment,
    StrictMode,
    Profiler,
    
    // Hooks - Basic
    useState,
    useReducer,
    useEffect,
    useLayoutEffect,
    useMemo,
    useCallback,
    useRef,
    useContext,
    
    // Hooks - Advanced
    useImperativeHandle,
    useDebugValue,
    useId,
    useTransition,
    useDeferredValue,
    useSyncExternalStore,
    
    // Context
    createContext,
    
    // Refs
    createRef,
    forwardRef,
    
    // Element utilities
    cloneElement,
    isValidElement,
    Children,
    
    // Lifecycle helpers
    onMount,
    onUnmount,
    
    // Error handling
    withErrorBoundary,
    createErrorBoundary,
    
    // Performance
    memo,
    
    // Advanced features
    Suspense,
    lazy,
    createPortal,
    
    // Batching
    batchUpdates,
    flushSync,
    
    // Utilities
    forceUpdate,
    unmountComponentAtNode,
    
    // PropTypes
    PropTypes,
    
    // Configuration
    configure,
    
    // Debug utilities
    DEBUG_MODE,
    setDebugMode: (enabled) => { 
        DEBUG_MODE = enabled;
        CONFIG.debug.enabled = enabled;
    },
    getPerformanceReport: () => performanceMetrics.getReport(),
    resetPerformanceMetrics: () => performanceMetrics.reset(),
    
    // DevTools
    __devtools: DEBUG_MODE ? devTools : null,
    
    // Testing utilities
    TestUtils,
    
    // SSR
    renderToString,
    
    // Internal scheduler (exposed for advanced use)
    __scheduler: DEBUG_MODE ? scheduler : undefined,
    
    // HTML helpers
    ...elements
};

// Export for different environments
if (IS_BROWSER) {
    window.MyReact = MyReact;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MyReact;
}

if (typeof define === 'function' && define.amd) {
    define([], () => MyReact);
}