// Definizione di un componente
function Counter() {
  const [count, setCount] = useState(0);
  const [color, setColor] = useState("blue");

  // Esempio di effetto
  useEffect(() => {
	console.log(`Il contatore è ora: ${count}`);
	if (count % 2 === 0) {
	  setColor("blue");
	} else {
	  setColor("red");
	}
  }, [count]);

  return div(
	{ style: `text-align:center; margin-top:40px; color:${color}` },
	h1("Contatore MyReact"),
	p(`Valore attuale: ${count}`),
	button({ onClick: () => setCount(count + 1) }, "Incrementa"),
	button({ onClick: () => setCount(count - 1), style: "margin-left:8px;" }, "Decrementa"),
	button({ onClick: () => setCount(0), style: "margin-left:8px;" }, "Reset")
  );
}

// Monta l'app
root = document.getElementById("root");
render(Counter);