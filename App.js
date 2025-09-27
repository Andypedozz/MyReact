import Contacts from "./pages/Contacts.js"
import Home from "./pages/Home.js"
import Projects from "./pages/Projects.js"

function App() {
    const [page, setPage] = useState("Home")

    const renderPage = (pg) => {
        if(pg === "Home") return Home({ page, setPage })
        if(pg === "Projects") return Projects({ page, setPage })
        if(pg === "Contacts") return Contacts({ page, setPage })
    }

    return (
        renderPage(page)
    )
}

rerender = () => renderComponent(document.getElementById("app"), App);
rerender();
