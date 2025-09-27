
export default function Counter() {
    const [count, setCount] = useState(0);

    return (
        div(
            h1("Counter: " + count),
            button({ onClick: () => setCount(count + 1) }, "Incrementa"),
            button({ onClick: () => setCount(count - 1) }, "Decrementa")
        )
    );
}