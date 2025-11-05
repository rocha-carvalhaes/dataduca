import { useState } from 'react'
import Login from './components/Login'
import Layout from './components/Layout'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
  }

  if (isAuthenticated) {
    return <Layout />
  }

  return <Login onLoginSuccess={handleLoginSuccess} />
}

export default App
