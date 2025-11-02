import Header from "./components/Header";
import MCPServersList from "./components/MCPServersList";

const App = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex-1">
        <MCPServersList />
      </main>
    </div>
  );
};

export default App;
