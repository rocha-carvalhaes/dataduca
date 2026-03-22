function FormField({ label, id, children, hint }) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[#333333] mb-2"
        >
          {label}
        </label>
      )}
      {children}
      {hint && <p className="mt-1 text-xs text-[#6E6E6E]">{hint}</p>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none ${className}`}
      {...props}
    />
  );
}

export default FormField;
