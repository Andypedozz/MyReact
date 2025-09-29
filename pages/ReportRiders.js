import RidersSidebar from "../components/RidersSidebar.js"
import ReportRider from "./ReportRider.js"

export default function ReportRiders() {

    const [rider, setRider] = useState(null)

    const riders = [
        "Andrea Pedini",
        "Andrea Rossi",
        "Sara",
        "Michi"
    ]

    return (
        div(
            h3("Report rider"),
            RidersSidebar({ links: riders, rider, setRider }),
            ReportRider({ rider })
        )
    )
}