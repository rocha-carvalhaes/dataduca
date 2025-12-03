import { useState, useEffect } from 'react'
import api from '../config/api'

function Documents() {
  const [documents, setDocuments] = useState([])
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [documentName, setDocumentName] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [isNewDocument, setIsNewDocument] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    if (selectedDocument) {
      loadDocumentContent(selectedDocument.document_id)
    }
  }, [selectedDocument])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.documents.list()
      setDocuments(data)
    } catch (err) {
      setError(err.message || 'Erro ao carregar documentos. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadDocumentContent = async (documentId) => {
    try {
      setError(null)
      const doc = await api.documents.get(documentId)
      setContent(doc.document_content)
      setDocumentName(doc.document_name)
      setIsNewDocument(false)
    } catch (err) {
      setError(err.message || 'Erro ao carregar documento. Tente novamente.')
      console.error(err)
    }
  }

  const handleNewDocument = () => {
    setSelectedDocument(null)
    setContent('')
    setDocumentName('')
    setIsNewDocument(true)
    setIsPreviewMode(false)
    setIsEditingName(false)
    setError(null)
  }

  const handleSelectDocument = (doc) => {
    setSelectedDocument(doc)
    setDocumentName(doc.document_name)
    setIsNewDocument(false)
    setIsPreviewMode(false)
    setIsEditingName(false)
  }

  const handleSave = async () => {
    if (!content.trim()) {
      setError('O documento não pode estar vazio.')
      return
    }

    if (!documentName.trim()) {
      setError('O nome do documento não pode estar vazio.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setIsEditingName(false)
      
      if (isNewDocument) {
        await api.documents.create({ document_name: documentName, document_content: content })
      } else {
        await api.documents.update(selectedDocument.document_id, { 
          document_name: documentName,
          document_content: content 
        })
      }
      
      await loadDocuments()
      if (!isNewDocument) {
        // Recarregar o documento atualizado
        await loadDocumentContent(selectedDocument.document_id)
      } else {
        // Selecionar o novo documento criado
        const updated = await api.documents.list()
        if (updated.length > 0) {
          setSelectedDocument(updated[0])
        }
        setIsNewDocument(false)
      }
    } catch (err) {
      setError(err.message || 'Erro ao salvar documento. Tente novamente.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (documentId) => {
    if (!window.confirm('Tem certeza que deseja deletar este documento?')) {
      return
    }
    
    try {
      setError(null)
      await api.documents.delete(documentId)
      await loadDocuments()
      
      if (selectedDocument && selectedDocument.document_id === documentId) {
        setSelectedDocument(null)
        setContent('')
      }
    } catch (err) {
      setError(err.message || 'Erro ao deletar documento. Tente novamente.')
      console.error(err)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('pt-BR')
  }

  // Função para renderizar markdown básico
  const renderMarkdown = (text) => {
    if (!text) return ''
    
    // Dividir em linhas para processar títulos
    const lines = text.split('\n')
    const processedLines = lines.map(line => {
      // Processar títulos (devem estar no início da linha)
      if (line.match(/^######\s+(.+)$/)) {
        return line.replace(/^######\s+(.+)$/, '<h6>$1</h6>')
      } else if (line.match(/^#####\s+(.+)$/)) {
        return line.replace(/^#####\s+(.+)$/, '<h5>$1</h5>')
      } else if (line.match(/^####\s+(.+)$/)) {
        return line.replace(/^####\s+(.+)$/, '<h4>$1</h4>')
      } else if (line.match(/^###\s+(.+)$/)) {
        return line.replace(/^###\s+(.+)$/, '<h3>$1</h3>')
      } else if (line.match(/^##\s+(.+)$/)) {
        return line.replace(/^##\s+(.+)$/, '<h2>$1</h2>')
      } else if (line.match(/^#\s+(.+)$/)) {
        return line.replace(/^#\s+(.+)$/, '<h1>$1</h1>')
      }
      return line
    })
    
    // Juntar linhas e processar outras formatações
    let html = processedLines.join('\n')
    
    // Processar formatações apenas em linhas que não são títulos
    html = html.split('\n').map(line => {
      // Se a linha já é um título, retornar como está
      if (line.match(/^<h[1-6]>/)) {
        return line
      }
      // Caso contrário, processar formatações
      return line
        // Negrito: **texto** ou __texto__
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Itálico: *texto* ou _texto_
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
    }).join('\n')
    
    // Converter quebras de linha em <br /> (exceto após títulos)
    html = html.replace(/\n/g, '<br />')
    
    return html
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#6E6E6E]">Carregando documentos...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#333333] mb-2">
            Documentação
          </h1>
          <p className="text-[#777777]">
            Crie e edite documentos usando Markdown
          </p>
        </div>
        <button
          onClick={handleNewDocument}
          className="bg-[#E6A8D7] text-white px-6 py-2 rounded-lg hover:bg-[#D89BC8] transition-colors font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Documento
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Editor - Esquerda */}
        <div className="lg:col-span-2 flex flex-col" style={{ height: '100%' }}>
          <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden flex flex-col" style={{ height: '100%', maxHeight: '100%' }}>
            <div className="p-4 border-b border-[#D9D9D9] bg-[#F5F6F7] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4 flex-1">
                {isEditingName && !isPreviewMode ? (
                  <input
                    type="text"
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingName(false)
                      }
                      if (e.key === 'Escape') {
                        setIsEditingName(false)
                        if (selectedDocument) {
                          setDocumentName(selectedDocument.document_name)
                        } else {
                          setDocumentName('')
                        }
                      }
                    }}
                    className="text-lg font-semibold text-[#333333] bg-white border border-[#E6A8D7] rounded px-2 py-1 outline-none focus:ring-2 focus:ring-[#E6A8D7]"
                  />
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <h2 
                      className="font-semibold text-[#333333] cursor-pointer hover:text-[#E6A8D7] transition-colors"
                      onClick={() => {
                        if (!isPreviewMode && (selectedDocument || isNewDocument)) {
                          setIsEditingName(true)
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !isPreviewMode && (selectedDocument || isNewDocument)) {
                          e.preventDefault()
                          setIsEditingName(true)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      title="Clique para editar o nome"
                    >
                      {documentName || (isNewDocument ? 'Novo Documento' : selectedDocument ? `Documento #${selectedDocument.document_id}` : 'Selecione um documento')}
                    </h2>
                    {!isPreviewMode && (selectedDocument || isNewDocument) && (
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="p-1 rounded hover:bg-[#E6A8D7] hover:bg-opacity-20 transition-colors"
                        title="Editar nome"
                      >
                        <svg className="w-4 h-4 text-[#6E6E6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                {!isNewDocument && selectedDocument && (
                  <p className="text-xs text-[#6E6E6E]">
                    Criado por {selectedDocument.created_by_name} em {formatDate(selectedDocument.created_at)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                disabled={!selectedDocument && !isNewDocument}
                className="p-2 rounded-lg hover:bg-[#E6A8D7] hover:bg-opacity-20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={isPreviewMode ? 'Voltar para edição' : 'Visualizar Markdown'}
              >
                {isPreviewMode ? (
                  <svg className="w-5 h-5 text-[#E6A8D7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-[#6E6E6E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
              {isPreviewMode ? (
                // Modo Preview
                <div 
                  className="h-full p-4 overflow-y-auto text-sm prose prose-sm max-w-none"
                  style={{ 
                    lineHeight: '1.6',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                >
                  <style>{`
                    .markdown-preview h1 {
                      font-size: 2em;
                      font-weight: bold;
                      margin-top: 0.67em;
                      margin-bottom: 0.67em;
                    }
                    .markdown-preview h2 {
                      font-size: 1.5em;
                      font-weight: bold;
                      margin-top: 0.75em;
                      margin-bottom: 0.75em;
                    }
                    .markdown-preview h3 {
                      font-size: 1.17em;
                      font-weight: bold;
                      margin-top: 0.83em;
                      margin-bottom: 0.83em;
                    }
                    .markdown-preview h4 {
                      font-size: 1em;
                      font-weight: bold;
                      margin-top: 1em;
                      margin-bottom: 1em;
                    }
                    .markdown-preview h5 {
                      font-size: 0.83em;
                      font-weight: bold;
                      margin-top: 1.17em;
                      margin-bottom: 1.17em;
                    }
                    .markdown-preview h6 {
                      font-size: 0.67em;
                      font-weight: bold;
                      margin-top: 1.33em;
                      margin-bottom: 1.33em;
                    }
                    .markdown-preview strong {
                      font-weight: bold;
                    }
                    .markdown-preview em {
                      font-style: italic;
                    }
                  `}</style>
                  <div 
                    className="markdown-preview"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                </div>
              ) : (
                // Modo Editor
                <div className="h-full overflow-hidden" style={{ minHeight: 0, maxHeight: '100%', position: 'relative' }}>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      // Prevenir comportamento padrão do Enter que causa expansão
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        // Adicionar quebra de linha manualmente na posição do cursor
                        const textarea = e.target
                        const start = textarea.selectionStart
                        const end = textarea.selectionEnd
                        const newContent = content.substring(0, start) + '\n' + content.substring(end)
                        setContent(newContent)
                        // Restaurar posição do cursor após a quebra de linha
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 1
                        }, 0)
                      }
                    }}
                    placeholder="Digite seu conteúdo aqui...&#10;&#10;Use **negrito** ou __negrito__ para texto em negrito&#10;Use *itálico* ou _itálico_ para texto em itálico"
                    className="w-full h-full p-4 border-0 outline-none resize-none font-mono text-sm"
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      width: '100%',
                      height: '100%',
                      minHeight: 0,
                      maxHeight: '100%',
                      overflowY: 'auto',
                      boxSizing: 'border-box'
                    }}
                    disabled={!selectedDocument && !isNewDocument}
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#D9D9D9] bg-[#F5F6F7] flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={saving || (!selectedDocument && !isNewDocument) || isPreviewMode}
                className="px-6 py-2 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D89BC8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Lista de documentos - Direita */}
        <div className="lg:col-span-1 flex flex-col">
          <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-[#D9D9D9] bg-[#F5F6F7] flex-shrink-0">
              <h2 className="font-semibold text-[#333333]">Documentos</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {documents.length === 0 ? (
                <div className="p-6 text-center text-[#6E6E6E]">
                  Nenhum documento encontrado
                </div>
              ) : (
                <div className="divide-y divide-[#D9D9D9]">
                  {documents.map((doc) => (
                    <div
                      key={doc.document_id}
                      onClick={() => handleSelectDocument(doc)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelectDocument(doc)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`p-4 cursor-pointer hover:bg-[#F5F6F7] transition-colors ${
                        selectedDocument?.document_id === doc.document_id
                          ? 'bg-[#E6A8D7] bg-opacity-10 border-l-4 border-[#E6A8D7]'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#333333]">
                            {doc.document_name || `Documento #${doc.document_id}`}
                          </p>
                          <p className="text-xs text-[#6E6E6E] mt-1">
                            Por {doc.created_by_name}
                          </p>
                          <p className="text-xs text-[#6E6E6E]">
                            {formatDate(doc.updated_at)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(doc.document_id)
                          }}
                          className="text-red-600 hover:text-red-800 transition-colors ml-2"
                          title="Deletar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Documents

