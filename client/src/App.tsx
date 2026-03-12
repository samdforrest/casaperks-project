import { useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

function App() {
  const { token } = useAuth();

  if (!token) {
    return <LoginPage />;
  }

  return <Dashboard />;
}

export default App;
