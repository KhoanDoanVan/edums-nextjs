import type { InputHTMLAttributes, ReactNode } from "react";

interface AuthInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  leftIcon: ReactNode;
  rightNode?: ReactNode;
}

export const AuthInput = ({ leftIcon, rightNode, ...props }: AuthInputProps) => {
  return (
    <div className="flex h-10 overflow-hidden rounded-[4px] border border-[#c8cfd7] bg-white">
      <span className="flex w-9 items-center justify-center border-r border-[#c8cfd7] bg-[#edf2f6] text-[#5f6f80]">
        {leftIcon}
      </span>
      <input
        {...props}
        className="flex-1 border-0 bg-white px-3 text-sm text-[#1d2a39] outline-none placeholder:text-[#8d9bab]"
      />
      {rightNode ? (
        <span className="flex items-center justify-center border-l border-[#c8cfd7] px-2 text-[#5f6f80]">
          {rightNode}
        </span>
      ) : null}
    </div>
  );
};
