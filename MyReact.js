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
    'inline-grid': 'display: inline-grid',
    'hidden': 'display: none',
    'table': 'display: table',
    'table-row': 'display: table-row',
    'table-cell': 'display: table-cell',
    
    // Flex Direction
    'flex-row': 'flex-direction: row',
    'flex-col': 'flex-direction: column',
    'flex-row-reverse': 'flex-direction: row-reverse',
    'flex-col-reverse': 'flex-direction: column-reverse',
    
    // Flex Wrap
    'flex-wrap': 'flex-wrap: wrap',
    'flex-nowrap': 'flex-wrap: nowrap',
    'flex-wrap-reverse': 'flex-wrap: wrap-reverse',
    
    // Flex
    'flex-1': 'flex: 1 1 0%',
    'flex-auto': 'flex: 1 1 auto',
    'flex-initial': 'flex: 0 1 auto',
    'flex-none': 'flex: none',
    
    // Flex Grow & Shrink
    'flex-grow': 'flex-grow: 1',
    'flex-grow-0': 'flex-grow: 0',
    'flex-shrink': 'flex-shrink: 1',
    'flex-shrink-0': 'flex-shrink: 0',
    
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
    
    // Align Self
    'self-auto': 'align-self: auto',
    'self-start': 'align-self: flex-start',
    'self-end': 'align-self: flex-end',
    'self-center': 'align-self: center',
    'self-stretch': 'align-self: stretch',
    
    // Align Content
    'content-start': 'align-content: flex-start',
    'content-end': 'align-content: flex-end',
    'content-center': 'align-content: center',
    'content-between': 'align-content: space-between',
    'content-around': 'align-content: space-around',
    
    // Grid Template Columns
    'grid-cols-1': 'grid-template-columns: repeat(1, minmax(0, 1fr))',
    'grid-cols-2': 'grid-template-columns: repeat(2, minmax(0, 1fr))',
    'grid-cols-3': 'grid-template-columns: repeat(3, minmax(0, 1fr))',
    'grid-cols-4': 'grid-template-columns: repeat(4, minmax(0, 1fr))',
    'grid-cols-5': 'grid-template-columns: repeat(5, minmax(0, 1fr))',
    'grid-cols-6': 'grid-template-columns: repeat(6, minmax(0, 1fr))',
    'grid-cols-12': 'grid-template-columns: repeat(12, minmax(0, 1fr))',
    
    // Grid Template Rows
    'grid-rows-1': 'grid-template-rows: repeat(1, minmax(0, 1fr))',
    'grid-rows-2': 'grid-template-rows: repeat(2, minmax(0, 1fr))',
    'grid-rows-3': 'grid-template-rows: repeat(3, minmax(0, 1fr))',
    'grid-rows-4': 'grid-template-rows: repeat(4, minmax(0, 1fr))',
    
    // Gap
    'gap-0': 'gap: 0',
    'gap-1': 'gap: 0.25rem',
    'gap-2': 'gap: 0.5rem',
    'gap-3': 'gap: 0.75rem',
    'gap-4': 'gap: 1rem',
    'gap-5': 'gap: 1.25rem',
    'gap-6': 'gap: 1.5rem',
    'gap-8': 'gap: 2rem',
    'gap-10': 'gap: 2.5rem',
    'gap-12': 'gap: 3rem',
    
    'gap-x-2': 'column-gap: 0.5rem',
    'gap-x-4': 'column-gap: 1rem',
    'gap-x-6': 'column-gap: 1.5rem',
    
    'gap-y-2': 'row-gap: 0.5rem',
    'gap-y-4': 'row-gap: 1rem',
    'gap-y-6': 'row-gap: 1.5rem',
    
    // Padding
    'p-0': 'padding: 0',
    'p-1': 'padding: 0.25rem',
    'p-2': 'padding: 0.5rem',
    'p-3': 'padding: 0.75rem',
    'p-4': 'padding: 1rem',
    'p-5': 'padding: 1.25rem',
    'p-6': 'padding: 1.5rem',
    'p-8': 'padding: 2rem',
    'p-10': 'padding: 2.5rem',
    'p-12': 'padding: 3rem',
    'p-16': 'padding: 4rem',
    
    'px-0': 'padding-left: 0; padding-right: 0',
    'px-1': 'padding-left: 0.25rem; padding-right: 0.25rem',
    'px-2': 'padding-left: 0.5rem; padding-right: 0.5rem',
    'px-3': 'padding-left: 0.75rem; padding-right: 0.75rem',
    'px-4': 'padding-left: 1rem; padding-right: 1rem',
    'px-5': 'padding-left: 1.25rem; padding-right: 1.25rem',
    'px-6': 'padding-left: 1.5rem; padding-right: 1.5rem',
    'px-8': 'padding-left: 2rem; padding-right: 2rem',
    
    'py-0': 'padding-top: 0; padding-bottom: 0',
    'py-1': 'padding-top: 0.25rem; padding-bottom: 0.25rem',
    'py-2': 'padding-top: 0.5rem; padding-bottom: 0.5rem',
    'py-3': 'padding-top: 0.75rem; padding-bottom: 0.75rem',
    'py-4': 'padding-top: 1rem; padding-bottom: 1rem',
    'py-5': 'padding-top: 1.25rem; padding-bottom: 1.25rem',
    'py-6': 'padding-top: 1.5rem; padding-bottom: 1.5rem',
    'py-8': 'padding-top: 2rem; padding-bottom: 2rem',
    
    'pt-2': 'padding-top: 0.5rem',
    'pt-4': 'padding-top: 1rem',
    'pt-6': 'padding-top: 1.5rem',
    'pt-8': 'padding-top: 2rem',
    
    'pr-2': 'padding-right: 0.5rem',
    'pr-4': 'padding-right: 1rem',
    'pr-6': 'padding-right: 1.5rem',
    
    'pb-2': 'padding-bottom: 0.5rem',
    'pb-4': 'padding-bottom: 1rem',
    'pb-6': 'padding-bottom: 1.5rem',
    'pb-8': 'padding-bottom: 2rem',
    
    'pl-2': 'padding-left: 0.5rem',
    'pl-4': 'padding-left: 1rem',
    'pl-6': 'padding-left: 1.5rem',
    
    // Margin
    'm-0': 'margin: 0',
    'm-1': 'margin: 0.25rem',
    'm-2': 'margin: 0.5rem',
    'm-3': 'margin: 0.75rem',
    'm-4': 'margin: 1rem',
    'm-5': 'margin: 1.25rem',
    'm-6': 'margin: 1.5rem',
    'm-8': 'margin: 2rem',
    'm-10': 'margin: 2.5rem',
    'm-auto': 'margin: auto',
    
    'mx-0': 'margin-left: 0; margin-right: 0',
    'mx-1': 'margin-left: 0.25rem; margin-right: 0.25rem',
    'mx-2': 'margin-left: 0.5rem; margin-right: 0.5rem',
    'mx-4': 'margin-left: 1rem; margin-right: 1rem',
    'mx-auto': 'margin-left: auto; margin-right: auto',
    
    'my-0': 'margin-top: 0; margin-bottom: 0',
    'my-1': 'margin-top: 0.25rem; margin-bottom: 0.25rem',
    'my-2': 'margin-top: 0.5rem; margin-bottom: 0.5rem',
    'my-4': 'margin-top: 1rem; margin-bottom: 1rem',
    'my-6': 'margin-top: 1.5rem; margin-bottom: 1.5rem',
    'my-8': 'margin-top: 2rem; margin-bottom: 2rem',
    
    'mt-0': 'margin-top: 0',
    'mt-2': 'margin-top: 0.5rem',
    'mt-4': 'margin-top: 1rem',
    'mt-6': 'margin-top: 1.5rem',
    'mt-8': 'margin-top: 2rem',
    
    'mr-2': 'margin-right: 0.5rem',
    'mr-4': 'margin-right: 1rem',
    'mr-auto': 'margin-right: auto',
    
    'mb-0': 'margin-bottom: 0',
    'mb-2': 'margin-bottom: 0.5rem',
    'mb-4': 'margin-bottom: 1rem',
    'mb-6': 'margin-bottom: 1.5rem',
    'mb-8': 'margin-bottom: 2rem',
    
    'ml-2': 'margin-left: 0.5rem',
    'ml-4': 'margin-left: 1rem',
    'ml-auto': 'margin-left: auto',
    
    // Negative Margins
    '-m-1': 'margin: -0.25rem',
    '-m-2': 'margin: -0.5rem',
    '-m-4': 'margin: -1rem',
    
    '-mt-1': 'margin-top: -0.25rem',
    '-mt-2': 'margin-top: -0.5rem',
    '-mt-4': 'margin-top: -1rem',
    
    '-ml-1': 'margin-left: -0.25rem',
    '-ml-2': 'margin-left: -0.5rem',
    '-ml-4': 'margin-left: -1rem',
    
    // Width
    'w-0': 'width: 0',
    'w-px': 'width: 1px',
    'w-full': 'width: 100%',
    'w-screen': 'width: 100vw',
    'w-min': 'width: min-content',
    'w-max': 'width: max-content',
    'w-fit': 'width: fit-content',
    'w-1/2': 'width: 50%',
    'w-1/3': 'width: 33.333333%',
    'w-2/3': 'width: 66.666667%',
    'w-1/4': 'width: 25%',
    'w-2/4': 'width: 50%',
    'w-3/4': 'width: 75%',
    'w-1/5': 'width: 20%',
    'w-2/5': 'width: 40%',
    'w-3/5': 'width: 60%',
    'w-4/5': 'width: 80%',
    'w-auto': 'width: auto',
    
    // Fixed Widths
    'w-20': 'width: 5rem',
    'w-24': 'width: 6rem',
    'w-32': 'width: 8rem',
    'w-40': 'width: 10rem',
    'w-48': 'width: 12rem',
    'w-64': 'width: 16rem',
    'w-96': 'width: 24rem',
    
    // Min Width
    'min-w-0': 'min-width: 0',
    'min-w-full': 'min-width: 100%',
    'min-w-min': 'min-width: min-content',
    'min-w-max': 'min-width: max-content',
    
    // Max Width
    'max-w-xs': 'max-width: 20rem',
    'max-w-sm': 'max-width: 24rem',
    'max-w-md': 'max-width: 28rem',
    'max-w-lg': 'max-width: 32rem',
    'max-w-xl': 'max-width: 36rem',
    'max-w-2xl': 'max-width: 42rem',
    'max-w-3xl': 'max-width: 48rem',
    'max-w-4xl': 'max-width: 56rem',
    'max-w-5xl': 'max-width: 64rem',
    'max-w-6xl': 'max-width: 72rem',
    'max-w-7xl': 'max-width: 80rem',
    'max-w-full': 'max-width: 100%',
    'max-w-screen': 'max-width: 100vw',
    'max-w-none': 'max-width: none',
    
    // Height
    'h-0': 'height: 0',
    'h-px': 'height: 1px',
    'h-full': 'height: 100%',
    'h-screen': 'height: 100vh',
    'h-min': 'height: min-content',
    'h-max': 'height: max-content',
    'h-fit': 'height: fit-content',
    'h-auto': 'height: auto',
    
    // Fixed Heights
    'h-20': 'height: 5rem',
    'h-24': 'height: 6rem',
    'h-32': 'height: 8rem',
    'h-40': 'height: 10rem',
    'h-48': 'height: 12rem',
    'h-64': 'height: 16rem',
    'h-96': 'height: 24rem',
    
    // Min Height
    'min-h-0': 'min-height: 0',
    'min-h-full': 'min-height: 100%',
    'min-h-screen': 'min-height: 100vh',
    
    // Max Height
    'max-h-full': 'max-height: 100%',
    'max-h-screen': 'max-height: 100vh',
    'max-h-none': 'max-height: none',
    
    // Colors - Text (expanded palette)
    'text-white': 'color: #ffffff',
    'text-black': 'color: #000000',
    'text-transparent': 'color: transparent',
    
    'text-gray-50': 'color: #f9fafb',
    'text-gray-100': 'color: #f3f4f6',
    'text-gray-200': 'color: #e5e7eb',
    'text-gray-300': 'color: #d1d5db',
    'text-gray-400': 'color: #9ca3af',
    'text-gray-500': 'color: #6b7280',
    'text-gray-600': 'color: #4b5563',
    'text-gray-700': 'color: #374151',
    'text-gray-800': 'color: #1f2937',
    'text-gray-900': 'color: #111827',
    
    'text-red-400': 'color: #f87171',
    'text-red-500': 'color: #ef4444',
    'text-red-600': 'color: #dc2626',
    'text-red-700': 'color: #b91c1c',
    
    'text-orange-500': 'color: #f97316',
    'text-orange-600': 'color: #ea580c',
    
    'text-yellow-400': 'color: #facc15',
    'text-yellow-500': 'color: #f59e0b',
    'text-yellow-600': 'color: #d97706',
    
    'text-green-400': 'color: #4ade80',
    'text-green-500': 'color: #10b981',
    'text-green-600': 'color: #059669',
    'text-green-700': 'color: #047857',
    
    'text-blue-400': 'color: #60a5fa',
    'text-blue-500': 'color: #3b82f6',
    'text-blue-600': 'color: #2563eb',
    'text-blue-700': 'color: #1d4ed8',
    
    'text-indigo-500': 'color: #6366f1',
    'text-indigo-600': 'color: #4f46e5',
    
    'text-purple-400': 'color: #c084fc',
    'text-purple-500': 'color: #a855f7',
    'text-purple-600': 'color: #9333ea',
    
    'text-pink-500': 'color: #ec4899',
    'text-pink-600': 'color: #db2777',
    
    // Colors - Background (expanded palette)
    'bg-white': 'background-color: #ffffff',
    'bg-black': 'background-color: #000000',
    'bg-transparent': 'background-color: transparent',
    'bg-current': 'background-color: currentColor',
    
    'bg-gray-50': 'background-color: #f9fafb',
    'bg-gray-100': 'background-color: #f3f4f6',
    'bg-gray-200': 'background-color: #e5e7eb',
    'bg-gray-300': 'background-color: #d1d5db',
    'bg-gray-400': 'background-color: #9ca3af',
    'bg-gray-500': 'background-color: #6b7280',
    'bg-gray-600': 'background-color: #4b5563',
    'bg-gray-700': 'background-color: #374151',
    'bg-gray-800': 'background-color: #1f2937',
    'bg-gray-900': 'background-color: #111827',
    
    'bg-red-50': 'background-color: #fef2f2',
    'bg-red-100': 'background-color: #fee2e2',
    'bg-red-500': 'background-color: #ef4444',
    'bg-red-600': 'background-color: #dc2626',
    
    'bg-orange-500': 'background-color: #f97316',
    
    'bg-yellow-50': 'background-color: #fefce8',
    'bg-yellow-100': 'background-color: #fef9c3',
    'bg-yellow-500': 'background-color: #f59e0b',
    
    'bg-green-50': 'background-color: #f0fdf4',
    'bg-green-100': 'background-color: #dcfce7',
    'bg-green-500': 'background-color: #10b981',
    'bg-green-600': 'background-color: #059669',
    
    'bg-blue-50': 'background-color: #eff6ff',
    'bg-blue-100': 'background-color: #dbeafe',
    'bg-blue-500': 'background-color: #3b82f6',
    'bg-blue-600': 'background-color: #2563eb',
    'bg-blue-700': 'background-color: #1d4ed8',
    
    'bg-indigo-500': 'background-color: #6366f1',
    'bg-indigo-600': 'background-color: #4f46e5',
    
    'bg-purple-50': 'background-color: #faf5ff',
    'bg-purple-100': 'background-color: #f3e8ff',
    'bg-purple-500': 'background-color: #a855f7',
    'bg-purple-600': 'background-color: #9333ea',
    
    'bg-pink-500': 'background-color: #ec4899',
    
    // Border Radius
    'rounded-none': 'border-radius: 0',
    'rounded-sm': 'border-radius: 0.125rem',
    'rounded': 'border-radius: 0.25rem',
    'rounded-md': 'border-radius: 0.375rem',
    'rounded-lg': 'border-radius: 0.5rem',
    'rounded-xl': 'border-radius: 0.75rem',
    'rounded-2xl': 'border-radius: 1rem',
    'rounded-3xl': 'border-radius: 1.5rem',
    'rounded-full': 'border-radius: 9999px',
    
    'rounded-t': 'border-top-left-radius: 0.25rem; border-top-right-radius: 0.25rem',
    'rounded-r': 'border-top-right-radius: 0.25rem; border-bottom-right-radius: 0.25rem',
    'rounded-b': 'border-bottom-left-radius: 0.25rem; border-bottom-right-radius: 0.25rem',
    'rounded-l': 'border-top-left-radius: 0.25rem; border-bottom-left-radius: 0.25rem',
    
    'rounded-tl': 'border-top-left-radius: 0.25rem',
    'rounded-tr': 'border-top-right-radius: 0.25rem',
    'rounded-br': 'border-bottom-right-radius: 0.25rem',
    'rounded-bl': 'border-bottom-left-radius: 0.25rem',
    
    // Border Width
    'border-0': 'border-width: 0',
    'border': 'border-width: 1px; border-style: solid',
    'border-2': 'border-width: 2px; border-style: solid',
    'border-4': 'border-width: 4px; border-style: solid',
    'border-8': 'border-width: 8px; border-style: solid',
    
    'border-t': 'border-top-width: 1px; border-top-style: solid',
    'border-r': 'border-right-width: 1px; border-right-style: solid',
    'border-b': 'border-bottom-width: 1px; border-bottom-style: solid',
    'border-l': 'border-left-width: 1px; border-left-style: solid',
    
    'border-t-2': 'border-top-width: 2px; border-top-style: solid',
    'border-r-2': 'border-right-width: 2px; border-right-style: solid',
    'border-b-2': 'border-bottom-width: 2px; border-bottom-style: solid',
    'border-l-2': 'border-left-width: 2px; border-left-style: solid',
    
    // Border Style
    'border-solid': 'border-style: solid',
    'border-dashed': 'border-style: dashed',
    'border-dotted': 'border-style: dotted',
    'border-double': 'border-style: double',
    'border-none': 'border-style: none',
    
    // Border Color
    'border-transparent': 'border-color: transparent',
    'border-white': 'border-color: #ffffff',
    'border-black': 'border-color: #000000',
    'border-gray-200': 'border-color: #e5e7eb',
    'border-gray-300': 'border-color: #d1d5db',
    'border-gray-400': 'border-color: #9ca3af',
    'border-gray-500': 'border-color: #6b7280',
    'border-gray-600': 'border-color: #4b5563',
    'border-gray-700': 'border-color: #374151',
    'border-red-500': 'border-color: #ef4444',
    'border-blue-500': 'border-color: #3b82f6',
    'border-green-500': 'border-color: #10b981',
    
    // Font Size
    'text-xs': 'font-size: 0.75rem; line-height: 1rem',
    'text-sm': 'font-size: 0.875rem; line-height: 1.25rem',
    'text-base': 'font-size: 1rem; line-height: 1.5rem',
    'text-lg': 'font-size: 1.125rem; line-height: 1.75rem',
    'text-xl': 'font-size: 1.25rem; line-height: 1.75rem',
    'text-2xl': 'font-size: 1.5rem; line-height: 2rem',
    'text-3xl': 'font-size: 1.875rem; line-height: 2.25rem',
    'text-4xl': 'font-size: 2.25rem; line-height: 2.5rem',
    'text-5xl': 'font-size: 3rem; line-height: 1',
    'text-6xl': 'font-size: 3.75rem; line-height: 1',
    'text-7xl': 'font-size: 4.5rem; line-height: 1',
    'text-8xl': 'font-size: 6rem; line-height: 1',
    'text-9xl': 'font-size: 8rem; line-height: 1',
    
    // Font Weight
    'font-thin': 'font-weight: 100',
    'font-extralight': 'font-weight: 200',
    'font-light': 'font-weight: 300',
    'font-normal': 'font-weight: 400',
    'font-medium': 'font-weight: 500',
    'font-semibold': 'font-weight: 600',
    'font-bold': 'font-weight: 700',
    'font-extrabold': 'font-weight: 800',
    'font-black': 'font-weight: 900',
    
    // Font Family
    'font-sans': 'font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'font-serif': 'font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    'font-mono': 'font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    
    // Text Align
    'text-left': 'text-align: left',
    'text-center': 'text-align: center',
    'text-right': 'text-align: right',
    'text-justify': 'text-align: justify',
    
    // Text Decoration
    'underline': 'text-decoration-line: underline',
    'overline': 'text-decoration-line: overline',
    'line-through': 'text-decoration-line: line-through',
    'no-underline': 'text-decoration-line: none',
    
    // Text Transform
    'uppercase': 'text-transform: uppercase',
    'lowercase': 'text-transform: lowercase',
    'capitalize': 'text-transform: capitalize',
    'normal-case': 'text-transform: none',
    
    // Text Overflow
    'truncate': 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap',
    'text-ellipsis': 'text-overflow: ellipsis',
    'text-clip': 'text-overflow: clip',
    
    // Whitespace
    'whitespace-normal': 'white-space: normal',
    'whitespace-nowrap': 'white-space: nowrap',
    'whitespace-pre': 'white-space: pre',
    'whitespace-pre-line': 'white-space: pre-line',
    'whitespace-pre-wrap': 'white-space: pre-wrap',
    
    // Word Break
    'break-normal': 'overflow-wrap: normal; word-break: normal',
    'break-words': 'overflow-wrap: break-word',
    'break-all': 'word-break: break-all',
    
    // Line Height
    'leading-none': 'line-height: 1',
    'leading-tight': 'line-height: 1.25',
    'leading-snug': 'line-height: 1.375',
    'leading-normal': 'line-height: 1.5',
    'leading-relaxed': 'line-height: 1.625',
    'leading-loose': 'line-height: 2',
    
    // Letter Spacing
    'tracking-tighter': 'letter-spacing: -0.05em',
    'tracking-tight': 'letter-spacing: -0.025em',
    'tracking-normal': 'letter-spacing: 0',
    'tracking-wide': 'letter-spacing: 0.025em',
    'tracking-wider': 'letter-spacing: 0.05em',
    'tracking-widest': 'letter-spacing: 0.1em',
    
    // Shadow
    'shadow-none': 'box-shadow: none',
    'shadow-sm': 'box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'shadow': 'box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    'shadow-md': 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    'shadow-lg': 'box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    'shadow-xl': 'box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    'shadow-2xl': 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    'shadow-inner': 'box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
    
    // Opacity
    'opacity-0': 'opacity: 0',
    'opacity-5': 'opacity: 0.05',
    'opacity-10': 'opacity: 0.1',
    'opacity-20': 'opacity: 0.2',
    'opacity-25': 'opacity: 0.25',
    'opacity-30': 'opacity: 0.3',
    'opacity-40': 'opacity: 0.4',
    'opacity-50': 'opacity: 0.5',
    'opacity-60': 'opacity: 0.6',
    'opacity-70': 'opacity: 0.7',
    'opacity-75': 'opacity: 0.75',
    'opacity-80': 'opacity: 0.8',
    'opacity-90': 'opacity: 0.9',
    'opacity-95': 'opacity: 0.95',
    'opacity-100': 'opacity: 1',
    
    // Cursor
    'cursor-auto': 'cursor: auto',
    'cursor-default': 'cursor: default',
    'cursor-pointer': 'cursor: pointer',
    'cursor-wait': 'cursor: wait',
    'cursor-text': 'cursor: text',
    'cursor-move': 'cursor: move',
    'cursor-help': 'cursor: help',
    'cursor-not-allowed': 'cursor: not-allowed',
    'cursor-none': 'cursor: none',
    'cursor-grab': 'cursor: grab',
    'cursor-grabbing': 'cursor: grabbing',
    
    // User Select
    'select-none': 'user-select: none',
    'select-text': 'user-select: text',
    'select-all': 'user-select: all',
    'select-auto': 'user-select: auto',
    
    // Pointer Events
    'pointer-events-none': 'pointer-events: none',
    'pointer-events-auto': 'pointer-events: auto',
    
    // Position
    'static': 'position: static',
    'fixed': 'position: fixed',
    'absolute': 'position: absolute',
    'relative': 'position: relative',
    'sticky': 'position: sticky',
    
    // Inset (Top/Right/Bottom/Left)
    'inset-0': 'top: 0; right: 0; bottom: 0; left: 0',
    'inset-auto': 'top: auto; right: auto; bottom: auto; left: auto',
    
    'top-0': 'top: 0',
    'top-auto': 'top: auto',
    'right-0': 'right: 0',
    'right-auto': 'right: auto',
    'bottom-0': 'bottom: 0',
    'bottom-auto': 'bottom: auto',
    'left-0': 'left: 0',
    'left-auto': 'left: auto',
    
    'top-1': 'top: 0.25rem',
    'top-2': 'top: 0.5rem',
    'top-4': 'top: 1rem',
    'right-1': 'right: 0.25rem',
    'right-2': 'right: 0.5rem',
    'right-4': 'right: 1rem',
    'bottom-1': 'bottom: 0.25rem',
    'bottom-2': 'bottom: 0.5rem',
    'bottom-4': 'bottom: 1rem',
    'left-1': 'left: 0.25rem',
    'left-2': 'left: 0.5rem',
    'left-4': 'left: 1rem',
    
    // Z-Index
    'z-0': 'z-index: 0',
    'z-10': 'z-index: 10',
    'z-20': 'z-index: 20',
    'z-30': 'z-index: 30',
    'z-40': 'z-index: 40',
    'z-50': 'z-index: 50',
    'z-auto': 'z-index: auto',
    '-z-10': 'z-index: -10',
    
    // Overflow
    'overflow-auto': 'overflow: auto',
    'overflow-hidden': 'overflow: hidden',
    'overflow-clip': 'overflow: clip',
    'overflow-visible': 'overflow: visible',
    'overflow-scroll': 'overflow: scroll',
    
    'overflow-x-auto': 'overflow-x: auto',
    'overflow-x-hidden': 'overflow-x: hidden',
    'overflow-x-scroll': 'overflow-x: scroll',
    
    'overflow-y-auto': 'overflow-y: auto',
    'overflow-y-hidden': 'overflow-y: hidden',
    'overflow-y-scroll': 'overflow-y: scroll',
    
    // Visibility
    'visible': 'visibility: visible',
    'invisible': 'visibility: hidden',
    
    // Object Fit
    'object-contain': 'object-fit: contain',
    'object-cover': 'object-fit: cover',
    'object-fill': 'object-fit: fill',
    'object-none': 'object-fit: none',
    'object-scale-down': 'object-fit: scale-down',
    
    // Object Position
    'object-center': 'object-position: center',
    'object-top': 'object-position: top',
    'object-right': 'object-position: right',
    'object-bottom': 'object-position: bottom',
    'object-left': 'object-position: left',
    
    // Transition
    'transition-none': 'transition-property: none',
    'transition-all': 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
    'transition': 'transition-property: background-color, border-color, color, fill, stroke, opacity, box-shadow, transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
    'transition-colors': 'transition-property: background-color, border-color, color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
    'transition-opacity': 'transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
    'transition-transform': 'transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms',
    
    // Duration
    'duration-75': 'transition-duration: 75ms',
    'duration-100': 'transition-duration: 100ms',
    'duration-150': 'transition-duration: 150ms',
    'duration-200': 'transition-duration: 200ms',
    'duration-300': 'transition-duration: 300ms',
    'duration-500': 'transition-duration: 500ms',
    'duration-700': 'transition-duration: 700ms',
    'duration-1000': 'transition-duration: 1000ms',
    
    // Ease
    'ease-linear': 'transition-timing-function: linear',
    'ease-in': 'transition-timing-function: cubic-bezier(0.4, 0, 1, 1)',
    'ease-out': 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1)',
    'ease-in-out': 'transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)',
    
    // Transform
    'transform': 'transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))',
    'transform-none': 'transform: none',
    
    // Scale
    'scale-0': 'transform: scale(0)',
    'scale-50': 'transform: scale(0.5)',
    'scale-75': 'transform: scale(0.75)',
    'scale-90': 'transform: scale(0.9)',
    'scale-95': 'transform: scale(0.95)',
    'scale-100': 'transform: scale(1)',
    'scale-105': 'transform: scale(1.05)',
    'scale-110': 'transform: scale(1.1)',
    'scale-125': 'transform: scale(1.25)',
    'scale-150': 'transform: scale(1.5)',
    
    // Rotate
    'rotate-0': 'transform: rotate(0deg)',
    'rotate-45': 'transform: rotate(45deg)',
    'rotate-90': 'transform: rotate(90deg)',
    'rotate-180': 'transform: rotate(180deg)',
    '-rotate-45': 'transform: rotate(-45deg)',
    '-rotate-90': 'transform: rotate(-90deg)',
    '-rotate-180': 'transform: rotate(-180deg)',
    
    // Translate
    'translate-x-0': 'transform: translateX(0)',
    'translate-x-1': 'transform: translateX(0.25rem)',
    'translate-x-2': 'transform: translateX(0.5rem)',
    'translate-x-4': 'transform: translateX(1rem)',
    '-translate-x-1': 'transform: translateX(-0.25rem)',
    '-translate-x-2': 'transform: translateX(-0.5rem)',
    '-translate-x-4': 'transform: translateX(-1rem)',
    
    'translate-y-0': 'transform: translateY(0)',
    'translate-y-1': 'transform: translateY(0.25rem)',
    'translate-y-2': 'transform: translateY(0.5rem)',
    'translate-y-4': 'transform: translateY(1rem)',
    '-translate-y-1': 'transform: translateY(-0.25rem)',
    '-translate-y-2': 'transform: translateY(-0.5rem)',
    '-translate-y-4': 'transform: translateY(-1rem)',
    
    // Backdrop Blur
    'backdrop-blur-none': 'backdrop-filter: blur(0)',
    'backdrop-blur-sm': 'backdrop-filter: blur(4px)',
    'backdrop-blur': 'backdrop-filter: blur(8px)',
    'backdrop-blur-md': 'backdrop-filter: blur(12px)',
    'backdrop-blur-lg': 'backdrop-filter: blur(16px)',
    'backdrop-blur-xl': 'backdrop-filter: blur(24px)',
    
    // Filter Blur
    'blur-none': 'filter: blur(0)',
    'blur-sm': 'filter: blur(4px)',
    'blur': 'filter: blur(8px)',
    'blur-md': 'filter: blur(12px)',
    'blur-lg': 'filter: blur(16px)',
    'blur-xl': 'filter: blur(24px)',
    
    // Outline
    'outline-none': 'outline: 2px solid transparent; outline-offset: 2px',
    'outline': 'outline-style: solid',
    'outline-dashed': 'outline-style: dashed',
    'outline-dotted': 'outline-style: dotted',
    'outline-double': 'outline-style: double',
    
    // Ring (focus states)
    'ring': 'box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5)',
    'ring-0': 'box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5)',
    'ring-1': 'box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5)',
    'ring-2': 'box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5)',
    'ring-4': 'box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5)',
    
    // List Style
    'list-none': 'list-style-type: none',
    'list-disc': 'list-style-type: disc',
    'list-decimal': 'list-style-type: decimal',
    
    // Appearance
    'appearance-none': 'appearance: none',
    
    // Columns
    'columns-1': 'columns: 1',
    'columns-2': 'columns: 2',
    'columns-3': 'columns: 3',
    'columns-4': 'columns: 4',
    'columns-auto': 'columns: auto',
    
    // Break
    'break-before-auto': 'break-before: auto',
    'break-before-avoid': 'break-before: avoid',
    'break-before-page': 'break-before: page',
    
    'break-after-auto': 'break-after: auto',
    'break-after-avoid': 'break-after: avoid',
    'break-after-page': 'break-after: page',
    
    // Box Decoration Break
    'box-decoration-clone': 'box-decoration-break: clone',
    'box-decoration-slice': 'box-decoration-break: slice',
    
    // Box Sizing
    'box-border': 'box-sizing: border-box',
    'box-content': 'box-sizing: content-box',
    
    // Aspect Ratio
    'aspect-auto': 'aspect-ratio: auto',
    'aspect-square': 'aspect-ratio: 1 / 1',
    'aspect-video': 'aspect-ratio: 16 / 9',
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