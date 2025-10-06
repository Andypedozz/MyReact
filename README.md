# Mini React
This project provides a simple implementation of a React-like library. You can decide to use it in two ways:
* If you're not interested in using import/export syntax you can just include the MyReact.js script in your index.html and then instantiating your app defining like in the example below:
```js
function App() {
	return (
		div(
			h1("Example Application")
		)
	)
}
root = document.getElementById("root")
render(App)
```
* if you're interested in using import/export you need to serve the application with a server and include your App.js file as a <script type="module" in your index.html file

The syntax used in to structure the pages is very similar to JSX, here's an example:
```js
// JSX
function App() {
	return (
		<div>
			<h1>Example Application</h1>
			<div className="sidebar">
				<button onClick={() => setPage("Home")}>Home</button>
			</div>
		</div>
	)
}

// Mini React
function App() {
	return (
		div(
			h1("Example Application),
			div({ class: "sidebar"},
				button({ onClick: () => setPage("Home")}, "Home")
			)
		)
	)
}
```

This implementation also supports multiple and independent useState hooks, but it doesn't support refresh of the page by diffing with VirtualDOMs like React, it just rerenders the whole page automatically when any of the state variables changes. 