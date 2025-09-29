import MenuSidebar from "./components/MenuSidebar.js"
import OnlineOffline from "./pages/OnlineOffline.js"
import ChiudiCassa from "./pages/ChiudiCassa.js"
import Documenti from "./pages/Documenti.js"
import ListaTelefonate from "./pages/ListaTelefonate.js"
import Stampe from "./pages/Stampe.js"
import ReportRiders from "./pages/ReportRiders.js"
import GestioneCassetto from "./pages/GestioneCassetto.js"



function PageA() {
  const [c, setC] = useState(0);
  return div(
    h1("Pagina A"),
    button({ onClick: () => setC(x => x + 1) }, "Inc A: " + c)
  );
}

function PageB() {
  const [t, setT] = useState(0);
  return div(
    h1("Pagina B"),
    button({ onClick: () => setT(x => x + 1) }, "Inc B: " + t)
  );
}

function App() {

    const [page, setPage] = useState("Report rider")
    const menuButtons = [
        "Online/Offline",
        "Lista telefonate",
        "Stampe in corso",
        "Gestione cassetto",
        "Chiudi cassa",
        "Documenti",
        "Report rider"
    ]

    const renderPage = (pg) => {
        switch(pg) {
            case "Online/Offline": return OnlineOffline()
            case "Lista telefonate": return ListaTelefonate()
            case "Stampe in corso": return Stampe()
            case "Gestione cassetto": return GestioneCassetto()
            case "Chiudi cassa": return ChiudiCassa()
            case "Documenti": return Documenti()
            case "Report rider": return ReportRiders()
        }
    }

    const style = `
        display: flex;
        flex-direction: row;
    `

    return (
        div({ class: "container"},
            MenuSidebar({ links: menuButtons, page, setPage }),
            div({ class: "pageContainer"},
                renderPage(page)
            )
        )
    )
    // const [page, setPage] = useState('A');
    // return div(
    //     button({ onClick: () => setPage('A') }, "Vai A"),
    //     button({ onClick: () => setPage('B') }, "Vai B"),
    //     page === 'A' ? PageA() : PageB()
    // );
}

rerender = () => renderComponent(document.getElementById("app"), App);
rerender();
