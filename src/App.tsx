import { useState } from "react";

function App() {
  const [message, setMessage] = useState("Nettgeflüster");

  return (
    <div className="container">
      <h1>{message}</h1>
      <p>Podcast Manager wird geladen...</p>
    </div>
  );
}

export default App;
