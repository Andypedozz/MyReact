let root = null;
let component;

// Mappa che associa ogni componente ai suoi stati
let componentStates = new Map();
let componentEffects = new Map(); // Mappa per gli effetti
let currentComponent = null;
let stateIndex = 0;
let componentStack = []; // Stack per tracciare la gerarchia di chiamate

function useState(initial) {
    // Usa l'ultimo componente nello stack (quello attualmente in esecuzione)
    const activeComponent = componentStack[componentStack.length - 1];
    
    // Ottieni o crea l'array di stati per il componente corrente
    if (!componentStates.has(activeComponent)) {
        componentStates.set(activeComponent, []);
    }
    
    const states = componentStates.get(activeComponent);
    
    // Usa un indice locale per questo specifico componente
    if (!activeComponent._stateIndex) {
        activeComponent._stateIndex = 0;
    }
    
    const currentIndex = activeComponent._stateIndex;

    // Se non c'è già un valore, inizializza
    if (states[currentIndex] === undefined) {
        states[currentIndex] = initial;
    }
    
    function setState(newValue) {
        states[currentIndex] = newValue;
        update();
    }
    
    activeComponent._stateIndex++; // passa al prossimo hook per questo componente
    return [states[currentIndex], setState];
}

function useEffect(callback, dependencies) {
    const activeComponent = componentStack[componentStack.length - 1];
    
    // Ottieni o crea l'array di effetti per il componente corrente
    if (!componentEffects.has(activeComponent)) {
        componentEffects.set(activeComponent, []);
    }
    
    const effects = componentEffects.get(activeComponent);
    
    // Usa un indice locale per questo specifico componente
    if (!activeComponent._effectIndex) {
        activeComponent._effectIndex = 0;
    }
    
    const currentIndex = activeComponent._effectIndex;
    
    // Recupera l'effetto precedente (se esiste)
    const prevEffect = effects[currentIndex];
    
    // Determina se l'effetto deve essere eseguito
    let shouldRun = false;
    
    if (!prevEffect) {
        // Prima esecuzione: esegui sempre
        shouldRun = true;
    } else if (!dependencies) {
        // Nessun array di dipendenze: esegui ad ogni render
        shouldRun = true;
    } else if (dependencies.length === 0) {
        // Array vuoto: esegui solo al mount (prima volta)
        shouldRun = false;
    } else {
        // Confronta le dipendenze
        shouldRun = dependencies.some((dep, i) => dep !== prevEffect.dependencies[i]);
    }
    
    // Salva l'effetto corrente
    effects[currentIndex] = {
        callback,
        dependencies: dependencies ? [...dependencies] : null
    };
    
    // Esegui l'effetto dopo il render (usando setTimeout per simulare il comportamento asincrono)
    if (shouldRun) {
        setTimeout(() => {
            callback();
        }, 0);
    }
    
    activeComponent._effectIndex++;
}

// Funzione helper per wrappare i componenti
function createComponent(fn) {
    return function(...args) {
        // Aggiungi questo componente allo stack
        componentStack.push(fn);
        
        // Reset dell'indice degli hook per questo componente
        fn._stateIndex = 0;
        fn._effectIndex = 0;
        
        // Esegui il componente
        const result = fn(...args);
        
        // Rimuovi il componente dallo stack
        componentStack.pop();
        
        return result;
    };
}

function h(tag, props, ...children) {
    const result = document.createElement(tag);
    if (props) {
        for (const [key, value] of Object.entries(props)) {
            if (key.startsWith("on") && typeof value === "function") {
                result[key.toLowerCase()] = value;
            } else {
                result.setAttribute(key, value);
            }
        }
    }
    
    for (const child of children) {
        if (typeof child === "string") {
            result.appendChild(document.createTextNode(child));
        } else if (typeof child === "function") {
            // Se il child è un componente, wrappalo e chiamalo
            result.appendChild(createComponent(child)());
        } else {
            result.appendChild(child);
        }
    }

    return result;
}

function update() {
    root.innerHTML = "";
    componentStack = []; // Reset dello stack
    render(component);
}

function render(comp) {
    component = comp;
    root.appendChild(createComponent(comp)());
}

// TAG FACTORY
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
            !(args[0] instanceof Node)
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