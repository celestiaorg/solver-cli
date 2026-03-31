import React, { useEffect, useState } from "react";

interface AnimatedDotsProps {
  text: string;
  className?: string;
}

export const AnimatedDots: React.FC<AnimatedDotsProps> = ({
  text,
  className,
}) => {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return ".";
        if (prev === "..") return "...";
        return "..";
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className={className}>
      {text}
      <span className="inline-block w-6 text-left">{dots}</span>
    </span>
  );
};
