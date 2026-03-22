function LoadingState({ message = 'Carregando...', spinner = false }) {
  if (spinner) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E6A8D7] mx-auto mb-4"></div>
            <p className="text-[#777777]">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-[#6E6E6E]">{message}</div>
    </div>
  );
}

export default LoadingState;
