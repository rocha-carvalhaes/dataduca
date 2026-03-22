function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`bg-white rounded-lg shadow border border-[#D9D9D9] ${padding ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export default Card;
