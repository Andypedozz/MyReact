// Definizione di un componente
function Counter() {
	const [count, setCount] = useState(0)

	return (
		div(
			h1("Example Application"),
			h3("Count: "+count),
			button({ onclick: () => setCount(count + 1)}, "Incrementa"),
			button({ onclick: () => setCount(count - 1)}, "Decrementa"),
		)
	)
}

// Monta l'app
root = document.getElementById("root");
render(Counter);