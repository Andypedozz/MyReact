export default function MenuSidebar(props) {
    const { links, page, setPage } = props;

    return (
        div({
            class: "sidebar",
            style: `
                width: 10%;
                height: 100vh;
                background: linear-gradient(180deg, #1f2937, #111827);
                display: flex;
                flex-direction: column;
                padding: 1rem;
                box-shadow: 2px 0 10px rgba(0,0,0,0.3);
            `
        },
            links.map(item =>
                button({
                    onClick: () => setPage(item),
                    style: `
                        background: #374151;
                        color: #f3f4f6;
                        border: none;
                        padding: 12px;
                        margin: 6px 0;
                        border-radius: 8px;
                        text-align: left;
                        font-size: 15px;
                        cursor: pointer;
                        transition: all 0.25s ease;
                    `,
                }, item)
            )
        )
    )
}
