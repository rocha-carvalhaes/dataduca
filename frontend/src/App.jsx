import { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import { authStorage } from './utils/auth';
import api from './config/api';
import { LoadingState } from './components/ui';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Verificar se há token válido ao carregar
    const checkAuth = async () => {
      const token = authStorage.getToken();
      if (token) {
        try {
          await api.auth.verify();
          setIsAuthenticated(true);
        } catch {
          // Token inválido ou expirado
          authStorage.clear();
          setIsAuthenticated(false);
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      authStorage.clear();
      setIsAuthenticated(false);
    }
  };

  if (isCheckingAuth) {
    return <LoadingState message="Verificando autenticação..." spinner />;
  }

  if (isAuthenticated) {
    return <Layout onLogout={handleLogout} />;
  }

  return <Login onLoginSuccess={handleLoginSuccess} />;
}

export default App;
