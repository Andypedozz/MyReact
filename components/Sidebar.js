
export default function Sidebar(props) {
    const { links, setPage } = props;

    return (
        div(
            links.map(item => button({ onClick: () => setPage(item)}, item))
        )
    )
}