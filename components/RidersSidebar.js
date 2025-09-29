export default function RidersSidebar(props) {

    const { links, rider, setRider } = props;

    return (
        div({
            class: "sidebar",
            style: `
                display: flex;
                flex-direction: column;
            `
        },
            links.map(item =>
                button({
                    onClick: () => setRider(item),
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
