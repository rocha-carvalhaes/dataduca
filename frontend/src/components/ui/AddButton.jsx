function AddButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#E6A8D7] text-white px-6 py-2 rounded-lg hover:bg-[#D89BC8] transition-colors font-medium flex items-center gap-2"
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
          d="M12 4v16m8-8H4"
        />
      </svg>
      {children}
    </button>
  );
}

export default AddButton;
