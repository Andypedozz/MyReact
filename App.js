function Sidebar() {

    return (
        div(
            
        )
    )
}

function Navbar() {
    
}

function Table(columns = [], data = []) {
    return (
        table(
            thead(
                columns.map(col => th(col))
            ),
            tbody(
                data.map(row => tr(
                    Object.keys(row).map(field => td(row[field]))
                ))
            )
        )
    )
}

function Button() {
    
}

function CheckBox() {
    
}

function Input() {
    
}

function App() {
    const [open, setOpen] = useState(true);

    const ppl = [
        { id: 1, name: "Andrea", surname: "Rossi", age: 30 },
        { id: 2, name: "Luca", surname: "Bianchi", age: 25 },
        { id: 3, name: "Nicole", surname: "Fabbri", age: 23 },
        { id: 4, name: "Maria", surname: "Verdi", age: 28 },
        { id: 5, name: "Giulia", surname: "Gialli", age: 22 },
    ];

    return div(
        h1("Registro Iscritti"),
        button({ onclick: () => setOpen(!open)}, "Apri/Chiudi"),
        open ? table(
            thead(th("ID"), th("Nome"), th("Cognome"), th("Eta")),
            tbody(
                ppl.map((person) =>
                    tr(
                        td(person.id),
                        td(person.name),
                        td(person.surname),
                        td(person.age),
                    ),
                ),
            ),
        ) : div(),
    );
}

// Monta l'app
const root = createRoot(document.getElementById("app"));
root.render(App);