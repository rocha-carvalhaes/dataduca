function BackButton({ onClick, label = 'Voltar' }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-[#6E6E6E] hover:text-[#333333] transition-colors mb-2"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
      {label}
    </button>
  );
}

export default BackButton;
