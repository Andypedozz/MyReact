import Sidebar from "../components/Sidebar.js";

export default function Contacts(props) {
    const {page, setPage} = props;
    const links = ["Home","Projects","Contacts"]

    return (
        div(
            Sidebar({ links, setPage}),
            "Contacts"
        )
    )
}