import { Route, Router, Switch } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthGuard } from "./components/AuthGuard";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

function Routes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/admin">
        <AuthGuard>
          <AdminPage />
        </AuthGuard>
      </Route>
      <Route path="/">
        <AuthGuard>
          <HomePage />
        </AuthGuard>
      </Route>
    </Switch>
  );
}

// initialPath is used in tests to render a specific route via memory router
export function App({ initialPath }: { initialPath?: string }) {
  if (initialPath !== undefined) {
    const { hook } = memoryLocation({ path: initialPath });
    return (
      <Router hook={hook}>
        <Routes />
      </Router>
    );
  }
  return <Routes />;
}
