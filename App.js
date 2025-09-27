function App() {
    return (
        div(
            { class: "container" },
            header(
                { class: "header" },
                h1("Studio di Fisioterapia Rossi"),
                p("Benvenuti nel mio studio, dove il tuo benessere è la priorità."),
                p("Offriamo trattamenti personalizzati per ogni esigenza.")
            ),
            section(
                { class: "services" },
                h2("I nostri servizi"),
                div(
                    { class: "cards-container" },
                    div({ class: "card" },
                        h3("Fisioterapia sportiva"),
                        p("Trattamenti mirati per atleti e appassionati di sport.")
                    ),
                    div({ class: "card" },
                        h3("Rieducazione post-operatoria"),
                        p("Supporto e terapia personalizzata dopo interventi chirurgici.")
                    ),
                    div({ class: "card" },
                        h3("Terapia manuale"),
                        p("Tecniche manuali per alleviare dolore e rigidità.")
                    ),
                    div({ class: "card" },
                        h3("Massoterapia"),
                        p("Massaggi terapeutici per il rilassamento e la prevenzione.")
                    )
                )
            ),
            section(
                { class: "contact" },
                h2("Contatti"),
                p("Indirizzo: Via Esempio 123, Milano"),
                p("Telefono: 0123 456789"),
                p("Email: info@fisioterapiarossi.it")
            ),
            footer(
                { class: "footer" },
                p("© 2025 Studio di Fisioterapia Rossi")
            )
        )
    )
}

rerender = () => renderComponent(document.getElementById("app"), App);
rerender();
