export const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('pt-BR');
};

export const formatResults = (results) => {
  if (!results || typeof results !== 'object') return '-';
  try {
    return JSON.stringify(results, null, 2);
  } catch {
    return String(results);
  }
};

export const confirmAction = (message) => {
  return window.confirm(message);
};
