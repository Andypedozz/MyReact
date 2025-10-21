/**
 * MyReact - A Production-Ready React-like Framework
 * Version 3.0.0 - Enhanced Edition
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
        enableProfiling: !IS_PRODUCTION,
        enableConcurrentMode: true,
        workUnitTimeSlice: 5 // ms per work unit
    },
    debug: {
        enabled: !IS_PRODUCTION,
        logRenders: false,
        trackComponentTree: true,
        warnOnSlowRenders: true,
        slowRenderThreshold: 16,
        captureStackTraces: true
    },
    features: {
        strictMode: true,
        suspense: true,
        portals: true,
        concurrentMode: false // Experimental
    }
};

function configure(userConfig) {
    CONFIG = { ...CONFIG, ...userConfig };
    DEBUG_MODE = CONFIG.debug.enabled;
}

let DEBUG_MODE = CONFIG.debug.enabled;

// ============================================================================
// Performance Metrics - Enhanced
// ============================================================================

const performanceMetrics = {
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    slowRenders: [],
    componentRenderTimes: new Map(),
    updatesByPriority: { high: 0, normal: 0, low: 0 },
    droppedFrames: 0,
    lastFrameTime: 0,
    
    recordRender(duration, componentName, priority = 'normal') {
        this.renderCount++;
        this.totalRenderTime += duration;
        this.averageRenderTime = this.totalRenderTime / this.renderCount;
        this.updatesByPriority[priority]++;
        
        // Track dropped frames (>16ms)
        const now = performance.now();
        if (this.lastFrameTime && (now - this.lastFrameTime) > 16) {
            this.droppedFrames++;
        }
        this.lastFrameTime = now;
        
        if (componentName) {
            if (!this.componentRenderTimes.has(componentName)) {
                this.componentRenderTimes.set(componentName, {
                    count: 0,
                    totalTime: 0,
                    avgTime: 0,
                    minTime: Infinity,
                    maxTime: 0
                });
            }
            const stats = this.componentRenderTimes.get(componentName);
            stats.count++;
            stats.totalTime += duration;
            stats.avgTime = stats.totalTime / stats.count;
            stats.minTime = Math.min(stats.minTime, duration);
            stats.maxTime = Math.max(stats.maxTime, duration);
        }
        
        if (duration > CONFIG.debug.slowRenderThreshold) {
            this.slowRenders.push({
                duration,
                componentName,
                priority,
                timestamp: Date.now(),
                stack: CONFIG.debug.captureStackTraces ? new Error().stack : null
            });
            
            if (CONFIG.debug.warnOnSlowRenders) {
                console.warn(`⚠️ Slow render detected: ${duration.toFixed(2)}ms in ${componentName || 'Unknown'}`);
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
            droppedFrames: this.droppedFrames,
            updatesByPriority: { ...this.updatesByPriority },
            componentStats: Array.from(this.componentRenderTimes.entries())
                .map(([name, stats]) => ({
                    component: name,
                    renders: stats.count,
                    avgTime: stats.avgTime.toFixed(2) + 'ms',
                    minTime: stats.minTime.toFixed(2) + 'ms',
                    maxTime: stats.maxTime.toFixed(2) + 'ms'
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
        this.updatesByPriority = { high: 0, normal: 0, low: 0 };
        this.droppedFrames = 0;
        this.lastFrameTime = 0;
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
                `❌ Required prop '${key}' was not specified in '${componentName}'.`
            );
            return;
        }
        
        if (value != null && !validator(value)) {
            console.error(
                `❌ Invalid prop '${key}' of value '${value}' supplied to '${componentName}'.`
            );
        }
    });
}

// ============================================================================
// Component Stack Tracking - Enhanced
// ============================================================================

class ComponentStack {
    constructor() {
        this.stack = [];
    }
    
    push(component, props, location) {
        this.stack.push({
            component,
            props: DEBUG_MODE ? { ...props } : null,
            name: component.name || 'Anonymous',
            location,
            timestamp: Date.now()
        });
    }
    
    pop() {
        return this.stack.pop();
    }
    
    peek() {
        return this.stack[this.stack.length - 1];
    }
    
    capture() {
        return this.stack.map(frame => ({
            name: frame.name,
            props: frame.props,
            duration: Date.now() - frame.timestamp
        }));
    }
    
    toString() {
        return this.stack
            .map(frame => `  at ${frame.name}`)
            .join('\n');
    }
    
    clear() {
        this.stack = [];
    }
}

const componentStack = new ComponentStack();

// ============================================================================
// Root Management
// ============================================================================

let root = null;
let component = null;
let rootVersion = 0;

// ============================================================================
// Component State Management - Enhanced with Linked List
// ============================================================================

class HookNode {
    constructor(type, value) {
        this.type = type; // 'state', 'effect', 'memo', etc.
        this.value = value;
        this.next = null;
        this.dependencies = null;
        this.cleanup = null;
    }
}

class HookList {
    constructor() {
        this.head = null;
        this.current = null;
    }
    
    reset() {
        this.current = this.head;
    }
    
    next(type, initialValue) {
        if (!this.current) {
            // First hook or end of list - create new
            const node = new HookNode(type, initialValue);
            if (!this.head) {
                this.head = node;
            } else {
                // Append to end
                let tail = this.head;
                while (tail.next) tail = tail.next;
                tail.next = node;
            }
            this.current = node;
            return node;
        }
        
        // Validate hook type consistency
        if (DEBUG_MODE && this.current.type !== type) {
            console.error(`Hook type mismatch! Expected ${this.current.type}, got ${type}`);
        }
        
        const node = this.current;
        this.current = this.current.next;
        return node;
    }
    
    cleanup() {
        let node = this.head;
        while (node) {
            if (node.cleanup) {
                try {
                    node.cleanup();
                } catch (error) {
                    if (DEBUG_MODE) {
                        console.error('Error in hook cleanup:', error);
                    }
                }
            }
            node = node.next;
        }
    }
}

const componentHooks = new Map();
const componentIds = new WeakMap();
const componentNames = new WeakMap();
const componentInstances = new Map();
let nextComponentId = 0;

// ============================================================================
// Fiber-like Work Unit System
// ============================================================================

class WorkUnit {
    constructor(type, component, props, parent, key) {
        this.type = type; // 'mount', 'update', 'unmount'
        this.component = component;
        this.props = props;
        this.parent = parent;
        this.key = key;
        this.priority = 'normal'; // 'high', 'normal', 'low'
        this.child = null;
        this.sibling = null;
        this.alternate = null; // Previous version
        this.effectTag = null; // 'PLACEMENT', 'UPDATE', 'DELETION'
        this.startTime = 0;
        this.expirationTime = 0;
    }
}

let workInProgress = null;
let currentRoot = null;
let nextUnitOfWork = null;
let deletions = [];

// ============================================================================
// Priority Queue for Work Scheduling
// ============================================================================

class PriorityQueue {
    constructor() {
        this.high = [];
        this.normal = [];
        this.low = [];
    }
    
    enqueue(work, priority = 'normal') {
        work.priority = priority;
        work.enqueueTime = performance.now();
        this[priority].push(work);
    }
    
    dequeue() {
        if (this.high.length > 0) {
            return this.high.shift();
        }
        if (this.normal.length > 0) {
            return this.normal.shift();
        }
        if (this.low.length > 0) {
            return this.low.shift();
        }
        return null;
    }
    
    peek() {
        if (this.high.length > 0) return this.high[0];
        if (this.normal.length > 0) return this.normal[0];
        if (this.low.length > 0) return this.low[0];
        return null;
    }
    
    isEmpty() {
        return this.high.length === 0 && 
               this.normal.length === 0 && 
               this.low.length === 0;
    }
    
    clear() {
        this.high = [];
        this.normal = [];
        this.low = [];
    }
    
    size() {
        return this.high.length + this.normal.length + this.low.length;
    }
}

const workQueue = new PriorityQueue();

// ============================================================================
// Execution Context Tracking
// ============================================================================

let activeComponentIds = new Set();
let currentInstanceKey = null;
let isInRender = false;
let hookCallOrder = [];
let currentHookList = null;

// ============================================================================
// Context Management - Enhanced with Stack
// ============================================================================

class ContextFrame {
    constructor(id, value) {
        this.id = id;
        this.value = value;
        this.subscribers = new Set();
    }
}

class ContextStack {
    constructor() {
        this.frames = [];
        this.cache = new Map();
    }
    
    push(id, value) {
        const frame = new ContextFrame(id, value);
        this.frames.push(frame);
        this.cache.set(id, frame);
    }
    
    pop(id) {
        for (let i = this.frames.length - 1; i >= 0; i--) {
            if (this.frames[i].id === id) {
                this.frames.splice(i, 1);
                this.rebuildCache();
                return;
            }
        }
    }
    
    get(id) {
        // Search from end (most recent first)
        for (let i = this.frames.length - 1; i >= 0; i--) {
            if (this.frames[i].id === id) {
                return this.frames[i];
            }
        }
        return null;
    }
    
    rebuildCache() {
        this.cache.clear();
        for (let i = this.frames.length - 1; i >= 0; i--) {
            const frame = this.frames[i];
            if (!this.cache.has(frame.id)) {
                this.cache.set(frame.id, frame);
            }
        }
    }
    
    clear() {
        this.frames = [];
        this.cache.clear();
    }
}

const contextStack = new ContextStack();
let nextContextId = 0;

// ============================================================================
// Virtual DOM Management
// ============================================================================

let oldVTree = null;
const domNodeMap = new WeakMap();
const vnodeToDom = new WeakMap();
const domToVnode = new WeakMap();

// ============================================================================
// Batching System - Enhanced
// ============================================================================

let updateScheduled = false;
let batchedUpdates = new Set();
const BATCH_DELAY = CONFIG.performance.batchDelay;
let currentBatchPriority = 'normal';

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
    'touchstart', 'touchend', 'touchmove', 'scroll', 'resize'
]);
let eventDelegationInitialized = false;
const globalEventListeners = new Map();

function initEventDelegation() {
    if (eventDelegationInitialized || !IS_BROWSER) return;
    
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
        
        const options = eventType === 'scroll' || eventType === 'resize' 
            ? { passive: true, capture: true }
            : { capture: true };
            
        document.addEventListener(eventType, handler, options);
        globalEventListeners.set(eventType, { handler, options });
    });
    
    eventDelegationInitialized = true;
}

function cleanupEventDelegation() {
    if (!IS_BROWSER) return;
    
    globalEventListeners.forEach(({ handler, options }, eventType) => {
        document.removeEventListener(eventType, handler, options);
    });
    globalEventListeners.clear();
    eventDelegationInitialized = false;
}

// ============================================================================
// Memory Management - Enhanced
// ============================================================================

const elementListeners = new WeakMap();
const cleanupRegistry = IS_BROWSER && typeof FinalizationRegistry !== 'undefined' 
    ? new FinalizationRegistry((instanceKey) => {
        if (DEBUG_MODE) {
            console.log('🧹 Cleaning up garbage collected component:', instanceKey);
        }
        cleanupComponent(instanceKey);
    })
    : null;

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
    
    elementListeners.delete(element);
    
    Array.from(element.children || []).forEach(cleanupDOMElement);
}

// ============================================================================
// Error Handling - Enhanced
// ============================================================================

class MyReactError extends Error {
    constructor(message, component, componentStack) {
        super(message);
        this.name = 'MyReactError';
        this.component = component;
        this.componentStack = componentStack;
        this.timestamp = Date.now();
    }
    
    toString() {
        let str = `${this.name}: ${this.message}`;
        if (this.componentStack) {
            str += '\n\nComponent Stack:\n' + this.componentStack;
        }
        return str;
    }
}

let errorBoundaryStack = [];

function captureError(error, component) {
    const componentName = component?.name || 'Unknown';
    const stack = componentStack.capture();
    const stackString = componentStack.toString();
    
    if (DEBUG_MODE) {
        console.error(`❌ Error in component ${componentName}:`, error);
        console.error('Component Stack:', stackString);
    }
    
    for (let i = errorBoundaryStack.length - 1; i >= 0; i--) {
        const boundary = errorBoundaryStack[i];
        if (boundary.onError) {
            boundary.onError(error, { 
                componentName,
                componentStack: stack,
                stackString 
            });
            return true;
        }
    }
    
    return false;
}

if (IS_BROWSER) {
    window.addEventListener('error', (event) => {
        if (DEBUG_MODE) {
            console.error('🌐 Global error caught:', event.error);
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        if (DEBUG_MODE) {
            console.error('🌐 Unhandled promise rejection:', event.reason);
        }
    });
}

// ============================================================================
// Component ID Management - Enhanced
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

function getInstanceKey(componentId, parentKey, indexInParent, key) {
    // Enhanced: include parent context and position
    return `${componentId}_${parentKey || 'root'}_${indexInParent}_${key || 'default'}`;
}

// ============================================================================
// Context API Implementation - Enhanced
// ============================================================================

function createContext(defaultValue) {
    const contextId = `context_${nextContextId++}`;
    
    const context = {
        _id: contextId,
        _defaultValue: defaultValue,
        _subscribers: new Set(),
        
        Provider: function({ value, children }) {
            const prevFrame = contextStack.get(contextId);
            contextStack.push(contextId, value);
            
            useLayoutEffect(() => {
                // Notify subscribers of value change
                if (prevFrame && !Object.is(prevFrame.value, value)) {
                    scheduleUpdate(() => update(), 'high');
                }
                
                return () => {
                    contextStack.pop(contextId);
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
    
    const frame = contextStack.get(context._id);
    
    if (frame) {
        // Subscribe current component to context changes
        if (currentInstanceKey) {
            frame.subscribers.add(currentInstanceKey);
        }
        return frame.value;
    }
    
    return context._defaultValue;
}

// ============================================================================
// Batching and Update Protection - Enhanced
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
            'Infinite render loop detected. Check your useEffect dependencies.',
            null,
            componentStack.toString()
        );
        console.error('🔄 Render loop detected! Too many updates per second.');
        throw error;
    }
}

function scheduleUpdate(updateFn, priority = 'normal') {
    const currentVersion = ++renderVersion;
    
    batchedUpdates.add(() => {
        if (renderVersion === currentVersion || 
            renderVersion === currentVersion + batchedUpdates.size - 1) {
            updateFn();
        }
    });
    
    // Track priority for metrics
    currentBatchPriority = priority;
    
    if (!updateScheduled) {
        updateScheduled = true;
        
        clearTimeout(debounceTimer);
        
        if (priority === 'high') {
            // Immediate update for high priority
            Promise.resolve().then(flushUpdates);
        } else {
            // Batched update for normal/low priority
            debounceTimer = setTimeout(() => {
                Promise.resolve().then(flushUpdates);
            }, BATCH_DELAY);
        }
    }
}

function flushUpdates() {
    if (batchedUpdates.size === 0) {
        updateScheduled = false;
        return;
    }
    
    const startTime = performance.now();
    
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
        
        const duration = performance.now() - startTime;
        performanceMetrics.recordRender(duration, 'BatchUpdate', currentBatchPriority);
        
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
            `${hookName} can only be called inside a component function`,
            null,
            componentStack.toString()
        );
    }
    
    if (CONFIG.features.strictMode && DEBUG_MODE) {
        hookCallOrder.push(hookName);
    }
}

function resetHookValidation() {
    hookCallOrder = [];
}

// ============================================================================
// React Hooks Implementation - Enhanced with Linked List
// ============================================================================

function useState(initial) {
    validateHookCall('useState');
    
    if (!currentHookList) {
        throw new MyReactError('useState called outside of component render');
    }
    
    const hook = currentHookList.next('state', typeof initial === 'function' ? initial() : initial);
    
    const instance = componentInstances.get(currentInstanceKey);
    
    function setState(newValue) {
        if (instance._unmounted) return;
        
        const value = typeof newValue === 'function' 
            ? newValue(hook.value) 
            : newValue;
        
        if (Object.is(hook.value, value)) {
            return;
        }
        
        hook.value = value;
        scheduleUpdate(() => update());
    }
    
    return [hook.value, setState];
}

function useReducer(reducer, initialState, init) {
    validateHookCall('useReducer');
    
    if (!currentHookList) {
        throw new MyReactError('useReducer called outside of component render');
    }
    
    const hook = currentHookList.next('reducer', init ? init(initialState) : initialState);
    
    const instance = componentInstances.get(currentInstanceKey);
    const activeComponent = componentStack.peek()?.component;
    
    function dispatch(action) {
        if (instance._unmounted) return;
        
        try {
            const newState = reducer(hook.value, action);
            
            if (Object.is(hook.value, newState)) {
                return;
            }
            
            hook.value = newState;
            scheduleUpdate(() => update());
        } catch (error) {
            captureError(error, activeComponent);
        }
    }
    
    return [hook.value, dispatch];
}

function useEffect(callback, dependencies) {
    validateHookCall('useEffect');
    
    if (!currentHookList) {
        throw new MyReactError('useEffect called outside of component render');
    }
    
    const hook = currentHookList.next('effect', {
        callback,
        dependencies: dependencies ? [...dependencies] : null,
        cleanup: null,
        isLayout: false
    });
    
    const instance = componentInstances.get(currentInstanceKey);
    const activeComponent = componentStack.peek()?.component;
    
    const shouldRun = shouldRunEffect(hook, dependencies);
    
    // Update dependencies
    hook.dependencies = dependencies ? [...dependencies] : null;
    
    if (shouldRun) {
        const timeoutId = setTimeout(() => {
            if (instance._unmounted || !activeComponentIds.has(currentInstanceKey)) {
                return;
            }
            
            if (hook.cleanup) {
                try {
                    hook.cleanup();
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
                    hook.cleanup = cleanup;
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
}

function useLayoutEffect(callback, dependencies) {
    validateHookCall('useLayoutEffect');
    
    if (!currentHookList) {
        throw new MyReactError('useLayoutEffect called outside of component render');
    }
    
    const hook = currentHookList.next('layoutEffect', {
        callback,
        dependencies: dependencies ? [...dependencies] : null,
        cleanup: null,
        isLayout: true
    });
    
    const instance = componentInstances.get(currentInstanceKey);
    const activeComponent = componentStack.peek()?.component;
    
    const shouldRun = shouldRunEffect(hook, dependencies);
    
    // Update dependencies
    hook.dependencies = dependencies ? [...dependencies] : null;
    
    if (shouldRun) {
        if (instance._unmounted || !activeComponentIds.has(currentInstanceKey)) {
            return;
        }
        
        if (hook.cleanup) {
            try {
                hook.cleanup();
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
                hook.cleanup = cleanup;
            }
        } catch (error) {
            if (DEBUG_MODE) {
                console.error('Error in layout effect:', error);
            }
            captureError(error, activeComponent);
        }
    }
}

function useMemo(factory, dependencies) {
    validateHookCall('useMemo');
    
    if (!currentHookList) {
        throw new MyReactError('useMemo called outside of component render');
    }
    
    const hook = currentHookList.next('memo', {
        value: undefined,
        dependencies: null,
        factory
    });
    
    const activeComponent = componentStack.peek()?.component;
    
    const shouldRecompute = !hook.dependencies || 
        !dependencies || 
        dependencies.some((dep, i) => !Object.is(dep, hook.dependencies[i]));
    
    if (shouldRecompute) {
        try {
            hook.value = factory();
            hook.dependencies = dependencies ? [...dependencies] : null;
        } catch (error) {
            captureError(error, activeComponent);
            throw error;
        }
    }
    
    return hook.value;
}

function useCallback(callback, dependencies) {
    validateHookCall('useCallback');
    return useMemo(() => callback, dependencies);
}

function shouldRunEffect(hook, dependencies) {
    if (!hook.dependencies) {
        return true;
    }
    
    if (!dependencies) {
        return true;
    }
    
    if (dependencies.length === 0) {
        return false;
    }
    
    return dependencies.some((dep, i) => !Object.is(dep, hook.dependencies[i]));
}

function useRef(initialValue) {
    validateHookCall('useRef');
    
    if (!currentHookList) {
        throw new MyReactError('useRef called outside of component render');
    }
    
    const hook = currentHookList.next('ref', { current: initialValue });
    return hook.value;
}

// ============================================================================
// Suspense Implementation - Enhanced with Cache
// ============================================================================

const suspenseCache = new WeakMap();
const suspensePromises = new Map();

class SuspenseResource {
    constructor(promise, key) {
        this.promise = promise;
        this.key = key;
        this.status = 'pending';
        this.value = null;
        this.error = null;
        
        promise
            .then(value => {
                this.status = 'success';
                this.value = value;
            })
            .catch(error => {
                this.status = 'error';
                this.error = error;
            });
    }
    
    read() {
        switch (this.status) {
            case 'pending':
                throw this.promise;
            case 'error':
                throw this.error;
            case 'success':
                return this.value;
        }
    }
}

function createResource(promiseFactory, key) {
    if (suspensePromises.has(key)) {
        return suspensePromises.get(key);
    }
    
    const resource = new SuspenseResource(promiseFactory(), key);
    suspensePromises.set(key, resource);
    
    return resource;
}

function Suspense({ fallback, children }) {
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const mountedRef = useRef(true);
    
    useEffect(() => {
        return () => {
            mountedRef.current = false;
        };
    }, []);
    
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
                    if (mountedRef.current) {
                        setIsLoading(false);
                        scheduleUpdate(() => update(), 'high');
                    }
                })
                .catch(err => {
                    if (mountedRef.current) {
                        setError(err);
                    }
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
// Error Boundary - Enhanced
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
            setErrorInfo({ componentName: Component.name, componentStack: componentStack.capture() });
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

function createComponent(fn, key, parentKey = null, indexInParent = 0) {
    return function(...args) {
        const startTime = CONFIG.performance.enableProfiling ? performance.now() : 0;
        
        const componentId = getComponentId(fn);
        const instanceKey = getInstanceKey(componentId, parentKey, indexInParent, key);
        
        if (!componentInstances.has(instanceKey)) {
            componentInstances.set(instanceKey, {
                _unmounted: false,
                _timeouts: [],
                _hookList: new HookList()
            });
            
            // Register with cleanup registry if available
            if (cleanupRegistry && typeof WeakRef !== 'undefined') {
                const ref = new WeakRef(componentInstances.get(instanceKey));
                cleanupRegistry.register(ref, instanceKey);
            }
        }
        
        const instance = componentInstances.get(instanceKey);
        
        // Reset hook list cursor
        instance._hookList.reset();
        
        activeComponentIds.add(instanceKey);
        componentStack.push(fn, args[0], `${fn.name}:${instanceKey}`);
        
        const previousInstanceKey = currentInstanceKey;
        const previousHookList = currentHookList;
        currentInstanceKey = instanceKey;
        currentHookList = instance._hookList;
        
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
            result = h('div', { className: 'error-fallback' }, 'Error rendering component');
        } finally {
            currentInstanceKey = previousInstanceKey;
            currentHookList = previousHookList;
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
// Optimized Keyed Reconciliation (Diffing Algorithm) - Enhanced
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
    // Enhanced: Build maps for efficient lookups with O(1) access
    const oldKeyedChildren = new Map();
    const oldUnkeyedChildren = [];
    
    oldChildren.forEach((child, index) => {
        if (child.key != null) {
            oldKeyedChildren.set(child.key, { child, index, used: false });
        } else {
            oldUnkeyedChildren.push({ child, index, used: false });
        }
    });
    
    let oldUnkeyedIndex = 0;
    const operations = []; // Track operations for batching
    
    // First pass: match and prepare operations
    newChildren.forEach((newChild, newIndex) => {
        let oldChild = null;
        let operation = null;
        
        if (newChild.key != null && oldKeyedChildren.has(newChild.key)) {
            const match = oldKeyedChildren.get(newChild.key);
            oldChild = match.child;
            match.used = true;
            operation = {
                type: 'update',
                oldChild,
                newChild,
                newIndex,
                shouldMove: match.index !== newIndex
            };
        } else if (newChild.key == null && oldUnkeyedIndex < oldUnkeyedChildren.length) {
            const match = oldUnkeyedChildren[oldUnkeyedIndex];
            oldChild = match.child;
            match.used = true;
            oldUnkeyedIndex++;
            operation = {
                type: 'update',
                oldChild,
                newChild,
                newIndex,
                shouldMove: false
            };
        } else {
            operation = {
                type: 'create',
                newChild,
                newIndex
            };
        }
        
        operations.push(operation);
    });
    
    // Execute operations
    operations.forEach(op => {
        if (op.type === 'update') {
            diff(parentDom, op.oldChild, op.newChild, op.newIndex);
            
            if (op.shouldMove) {
                const currentDom = vnodeToDom.get(op.newChild);
                const refNode = parentDom.childNodes[op.newIndex] || null;
                if (currentDom !== refNode) {
                    parentDom.insertBefore(currentDom, refNode);
                }
            }
        } else if (op.type === 'create') {
            const newDom = createDOMElement(op.newChild);
            const refNode = parentDom.childNodes[op.newIndex] || null;
            parentDom.insertBefore(newDom, refNode);
        }
    });
    
    // Cleanup unused nodes
    oldKeyedChildren.forEach(({ child, used }) => {
        if (!used) {
            const domNode = vnodeToDom.get(child);
            if (domNode?.parentNode) {
                cleanupDOMElement(domNode);
                domNode.parentNode.removeChild(domNode);
            }
            vnodeToDom.delete(child);
        }
    });
    
    oldUnkeyedChildren.slice(oldUnkeyedIndex).forEach(({ child }) => {
        const domNode = vnodeToDom.get(child);
        if (domNode?.parentNode) {
            cleanupDOMElement(domNode);
            domNode.parentNode.removeChild(domNode);
        }
        vnodeToDom.delete(child);
    });
}

// ============================================================================
// Component Cleanup with Memory Management - Enhanced
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
    
    // Run hook cleanups
    if (instance._hookList) {
        instance._hookList.cleanup();
    }
    
    // Clear component data
    componentHooks.delete(instanceKey);
    componentInstances.delete(instanceKey);
    
    if (DEBUG_MODE) {
        console.log('🧹 Component cleaned up:', instanceKey);
    }
}

// ============================================================================
// Rendering - Enhanced
// ============================================================================

function update() {
    if (!root || !component) return;
    
    const startTime = CONFIG.performance.enableProfiling ? performance.now() : 0;
    
    try {
        const previousActiveIds = new Set(activeComponentIds);
        activeComponentIds.clear();
        componentStack.clear();
        contextStack.clear();
        
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
        console.error('❌ Error during update:', error);
        if (!captureError(error)) {
            throw error;
        }
    }
}

function render(comp) {
    component = comp;
    activeComponentIds.clear();
    contextStack.clear();
    
    try {
        const newVTree = createComponent(comp)();
        const dom = createDOMElement(newVTree);
        if (dom) {
            root.appendChild(dom);
        }
        oldVTree = newVTree;
    } catch (error) {
        console.error('❌ Error during initial render:', error);
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
            contextStack.clear();
            
            try {
                container.innerHTML = "";
                
                const newVTree = createComponent(comp)();
                const dom = createDOMElement(newVTree);
                if (dom) {
                    container.appendChild(dom);
                }
                oldVTree = newVTree;
            } catch (error) {
                console.error('❌ Error during render:', error);
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
            contextStack.clear();
            
            // Clear all maps
            componentHooks.clear();
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
    contextStack.clear();
    
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
        console.error('❌ Error during hydration:', error);
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
// DevTools Integration - Enhanced
// ============================================================================

const devTools = {
    version: "3.0.0",
    renderers: new Map(),
    componentTree: null,
    isConnected: false,
    
    init() {
        if (!IS_BROWSER || !DEBUG_MODE) return;
        
        window.__MYREACT_DEVTOOLS__ = this;
        this.isConnected = true;
        
        // Listen for devtools messages
        window.addEventListener('message', (event) => {
            if (event.data?.source === 'myreact-devtools') {
                this.handleDevToolsMessage(event.data);
            }
        });
        
        // Notify devtools of connection
        this.sendMessage('INIT', { version: this.version });
        
        if (DEBUG_MODE) {
            console.log('🔧 MyReact DevTools initialized');
        }
    },
    
    sendMessage(type, data) {
        if (!this.isConnected) return;
        
        window.postMessage({
            source: 'myreact-devtools-response',
            type,
            data,
            timestamp: Date.now()
        }, '*');
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
            case 'HIGHLIGHT_COMPONENT':
                this.highlightComponent(message.instanceKey);
                break;
            case 'FORCE_UPDATE':
                this.forceComponentUpdate(message.instanceKey);
                break;
        }
    },
    
    sendComponentTree() {
        const tree = this.buildComponentTree();
        this.sendMessage('COMPONENT_TREE', tree);
    },
    
    sendPerformanceData() {
        this.sendMessage('PERFORMANCE_DATA', performanceMetrics.getReport());
    },
    
    buildComponentTree() {
        const tree = [];
        
        componentInstances.forEach((instance, key) => {
            const hooks = [];
            let node = instance._hookList?.head;
            while (node) {
                hooks.push({
                    type: node.type,
                    hasDependencies: node.dependencies != null,
                    hasCleanup: node.cleanup != null
                });
                node = node.next;
            }
            
            tree.push({
                key,
                unmounted: instance._unmounted,
                hookCount: hooks.length,
                hooks,
                timeouts: instance._timeouts?.length || 0
            });
        });
        
        return tree;
    },
    
    inspectComponent(instanceKey) {
        const instance = componentInstances.get(instanceKey);
        if (!instance) {
            this.sendMessage('COMPONENT_NOT_FOUND', { instanceKey });
            return;
        }
        
        const hooks = [];
        let node = instance._hookList?.head;
        while (node) {
            hooks.push({
                type: node.type,
                value: this.serializeValue(node.value),
                dependencies: node.dependencies,
                hasCleanup: !!node.cleanup
            });
            node = node.next;
        }
        
        this.sendMessage('COMPONENT_DETAILS', {
            instanceKey,
            unmounted: instance._unmounted,
            hooks,
            timeouts: instance._timeouts?.length || 0
        });
    },
    
    serializeValue(value) {
        if (value === null || value === undefined) return value;
        if (typeof value === 'function') return '[Function]';
        if (typeof value === 'symbol') return value.toString();
        if (typeof value === 'object') {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch {
                return '[Circular or Complex Object]';
            }
        }
        return value;
    },
    
    highlightComponent(instanceKey) {
        // Find DOM node associated with component
        // This is a simplified implementation
        if (DEBUG_MODE) {
            console.log('🎯 Highlighting component:', instanceKey);
        }
    },
    
    forceComponentUpdate(instanceKey) {
        if (componentInstances.has(instanceKey)) {
            scheduleUpdate(() => update(), 'high');
            if (DEBUG_MODE) {
                console.log('🔄 Forcing update for:', instanceKey);
            }
        }
    },
    
    disconnect() {
        this.isConnected = false;
        if (DEBUG_MODE) {
            console.log('🔌 MyReact DevTools disconnected');
        }
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
    scheduleUpdate(() => update(), 'high');
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
    
    if (devTools && devTools.isConnected) {
        const activeComponent = componentStack.peek();
        const componentName = activeComponent ? getComponentName(activeComponent.component) : 'Unknown';
        // Store debug value for devtools inspection
        if (!activeComponent._debugValues) {
            activeComponent._debugValues = [];
        }
        activeComponent._debugValues.push(formattedValue);
    }
}

// ============================================================================
// Additional Hooks - useId
// ============================================================================

let idCounter = 0;

function useId() {
    validateHookCall('useId');
    
    if (!currentHookList) {
        throw new MyReactError('useId called outside of component render');
    }
    
    const hook = currentHookList.next('id', `myreact-${++idCounter}`);
    return hook.value;
}

// ============================================================================
// Additional Hooks - useTransition
// ============================================================================

function useTransition() {
    validateHookCall('useTransition');
    
    const [isPending, setIsPending] = useState(false);
    
    const startTransition = useCallback((callback) => {
        setIsPending(true);
        
        // Use lower priority for transition updates
        scheduler.scheduleTask(() => {
            try {
                callback();
            } finally {
                setIsPending(false);
            }
        }, 'low');
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
        scheduler.scheduleTask(() => {
            setDeferredValue(value);
        }, 'low');
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
    if (!DEBUG_MODE || !CONFIG.features.strictMode) {
        return children;
    }
    
    const [renderCount, setRenderCount] = useState(0);
    
    useEffect(() => {
        if (renderCount === 0) {
            setRenderCount(1);
        }
    }, [renderCount]);
    
    if (renderCount < 1) {
        // Double render to detect side effects
        try {
            if (typeof children === 'function') {
                children();
            }
        } catch (error) {
            console.warn('⚠️ StrictMode detected an issue:', error);
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
    const renderCount = useRef(0);
    
    useLayoutEffect(() => {
        renderStartTime.current = performance.now();
    });
    
    useEffect(() => {
        const renderDuration = performance.now() - renderStartTime.current;
        const phase = renderCount.current === 0 ? 'mount' : 'update';
        renderCount.current++;
        
        if (onRender) {
            onRender(id, phase, renderDuration, {
                renderCount: renderCount.current,
                mountTime: mountTime.current
            });
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
            boundary.onError(err, { componentStack: componentStack.capture() });
            return FallbackComponent({ 
                error: err, 
                errorInfo: { componentStack: componentStack.capture() },
                resetError,
                errorCount: errorCount + 1
            });
        }
    };
}

// ============================================================================
// Development Warnings - Enhanced
// ============================================================================

const devWarnings = {
    warnedKeys: new Set(),
    
    warnOnce(key, message) {
        if (!DEBUG_MODE || this.warnedKeys.has(key)) return;
        this.warnedKeys.add(key);
        console.warn(`⚠️ [MyReact Warning]: ${message}`);
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
    },
    
    checkHookRules() {
        if (!CONFIG.features.strictMode || !DEBUG_MODE) return;
        
        // Validate hooks were called in same order
        const currentOrder = hookCallOrder.join(',');
        const key = currentInstanceKey;
        
        if (!this._hookOrders) {
            this._hookOrders = new Map();
        }
        
        if (this._hookOrders.has(key)) {
            const previousOrder = this._hookOrders.get(key);
            if (previousOrder !== currentOrder) {
                this.warnOnce(`hook-order-${key}`,
                    'Hook call order changed between renders. This can lead to bugs.'
                );
            }
        } else {
            this._hookOrders.set(key, currentOrder);
        }
    }
};

// ============================================================================
// Testing Utilities - Enhanced
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
    
    mockComponent(name, render) {
        const mock = function(props) {
            const defaultRender = h('div', { 'data-testid': name }, props.children);
            return render ? render(props) : defaultRender;
        };
        mock.displayName = name;
        return mock;
    },
    
    findByTestId(container, testId) {
        return container.querySelector(`[data-testid="${testId}"]`);
    },
    
    findAllByTestId(container, testId) {
        return Array.from(container.querySelectorAll(`[data-testid="${testId}"]`));
    },
    
    renderIntoDocument(component) {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        root.render(component);
        return { container, root };
    },
    
    cleanup(root, container) {
        if (root) root.unmount();
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    },
    
    fireEvent(element, eventType, eventData = {}) {
        const event = new Event(eventType, { bubbles: true, cancelable: true, ...eventData });
        Object.assign(event, eventData);
        element.dispatchEvent(event);
    }
};

// ============================================================================
// Server-Side Rendering - Enhanced
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
        .filter(key => key !== 'key' && key !== 'ref' && key !== 'children' && key !== 'dangerouslySetInnerHTML')
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
            if (typeof props[key] === 'boolean') {
                return props[key] ? key : '';
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
    
    let childrenHtml = '';
    
    if (props?.dangerouslySetInnerHTML) {
        childrenHtml = props.dangerouslySetInnerHTML.__html;
    } else {
        childrenHtml = (children || [])
            .map(child => renderToString(child))
            .join('');
    }
    
    return `${openTag}${childrenHtml}</${type}>`;
}

function renderToStaticMarkup(element) {
    // Same as renderToString but without data-reactid attributes
    return renderToString(element);
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
// Performance Optimization - Scheduler Enhanced
// ============================================================================

const scheduler = {
    tasks: [],
    isScheduled: false,
    deadline: null,
    currentPriority: 'normal',
    
    scheduleTask(callback, priority = 'normal') {
        const task = {
            callback,
            priority,
            timestamp: Date.now(),
            id: Math.random().toString(36)
        };
        
        workQueue.enqueue(task, priority);
        
        if (!this.isScheduled) {
            this.isScheduled = true;
            this.scheduleWork();
        }
    },
    
    scheduleWork() {
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback((deadline) => this.processTasks(deadline));
        } else {
            setTimeout(() => this.processTasks({ 
                timeRemaining: () => 16,
                didTimeout: false 
            }), 0);
        }
    },
    
    processTasks(deadline) {
        this.deadline = deadline;
        const startTime = performance.now();
        
        while (!workQueue.isEmpty() && deadline.timeRemaining() > 1) {
            const task = workQueue.dequeue();
            if (!task) break;
            
            this.currentPriority = task.priority;
            
            try {
                task.callback();
            } catch (error) {
                console.error('❌ Error in scheduled task:', error);
            }
            
            // Track time spent
            const elapsed = performance.now() - startTime;
            if (elapsed > 50) break; // Don't block too long
        }
        
        if (!workQueue.isEmpty()) {
            this.scheduleWork();
        } else {
            this.isScheduled = false;
        }
    },
    
    getCurrentPriority() {
        return this.currentPriority;
    },
    
    shouldYield() {
        return this.deadline && this.deadline.timeRemaining() <= 1;
    }
};

// Polyfill for requestIdleCallback
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
    
    window.cancelIdleCallback = function(id) {
        clearTimeout(id);
    };
}

// ============================================================================
// Public API & Exports
// ============================================================================

const MyReact = {
    // Version
    version: "3.0.0",
    
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
    createResource,
    
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
        if (enabled && IS_BROWSER) {
            devTools.init();
        }
    },
    getPerformanceReport: () => performanceMetrics.getReport(),
    resetPerformanceMetrics: () => performanceMetrics.reset(),
    
    // DevTools
    __devtools: DEBUG_MODE ? devTools : null,
    
    // Testing utilities
    TestUtils,
    
    // SSR
    renderToString,
    renderToStaticMarkup,
    
    // Internal scheduler (exposed for advanced use)
    __scheduler: DEBUG_MODE ? scheduler : undefined,
    
    // Internal APIs (for debugging)
    __internals: DEBUG_MODE ? {
        componentInstances,
        componentStack,
        contextStack,
        workQueue,
        vnodeToDom,
        domToVnode
    } : undefined,
    
    // HTML helpers
    ...elements
};

// Export for different environments
if (IS_BROWSER) {
    window.MyReact = MyReact;
    
    // Expose to console in debug mode
    if (DEBUG_MODE) {
        console.log('%c🚀 MyReact v3.0.0 Enhanced Edition loaded!', 
            'color: #61dafb; font-size: 14px; font-weight: bold;');
        console.log('%cDebug mode enabled. Access via window.MyReact', 
            'color: #888; font-size: 12px;');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MyReact;
}

if (typeof define === 'function' && define.amd) {
    define([], () => MyReact);
}

// ES Module export
if (typeof exports === 'object') {
    Object.assign(exports, MyReact);
}