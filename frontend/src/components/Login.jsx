import { useState } from 'react'
import dataducaLogo from '../assets/dataduca_logo_01.png'

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!username || !password) {
      alert('Por favor, preencha todos os campos')
      return
    }

    setIsLoading(true)
    
    // TODO: Implementar chamada à API de autenticação
    try {
      // Simulação de login
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Login:', { username, password })
      // Aqui você fará a chamada à API
      // Após sucesso, chama o callback
      if (onLoginSuccess) {
        onLoginSuccess()
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error)
      alert('Erro ao fazer login. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 pt-8 pb-4"
      style={{ background: 'linear-gradient(90deg, #B8E3C0, #E6A8D7)' }}
    >
      <div className="w-full max-w-md">
        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-[#D9D9D9]">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src={dataducaLogo} 
              alt="Dataduca Logo" 
              className="h-36 w-auto object-contain"
            />
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#333333] mb-2">
              Bem-vindo
            </h1>
            <p className="text-[#777777]">
              Entre com suas credenciais para continuar
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Usuário */}
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Usuário
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                className="w-full px-4 py-3 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none transition-all bg-white text-[#333333] placeholder-[#777777]"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            {/* Campo Senha */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full px-4 py-3 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none transition-all bg-white text-[#333333] placeholder-[#777777] pr-12"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#6E6E6E] hover:text-[#333333] focus:outline-none"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Botão de Login */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#E6A8D7] hover:bg-[#d897c8] text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Link de esqueci a senha (opcional) */}
          <div className="text-center pt-4">
            <a 
              href="#" 
              className="text-sm text-[#E6A8D7] hover:text-[#d897c8] transition-colors"
            >
              Esqueci minha senha
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-[#777777] mt-6">
          © 2025 Dataduca. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}

export default Login

