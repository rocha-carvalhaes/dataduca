import { useState, useEffect } from 'react';
import Login from './components/Login';
import Layout from './components/Layout';
import { authStorage } from './utils/auth';
import api from './config/api';

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E6A8D7] mx-auto mb-4"></div>
          <p className="text-[#777777]">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Layout onLogout={handleLogout} />;
  }

  return <Login onLoginSuccess={handleLoginSuccess} />;
}

export default App;
