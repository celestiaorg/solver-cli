export const BaseIcon = (props: React.ComponentProps<"svg">) => {
  return (
    <svg
      width="60"
      height="60"
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M60 30C60 13.4315 46.5685 0 30 0C13.4315 0 0 13.4315 0 30C0 46.5685 13.4315 60 30 60C46.5685 60 60 46.5685 60 30Z"
        fill="#1652F0"
      />
      <path
        d="M29.9475 60C46.545 60 60 46.5683 60 30C60 13.4314 46.545 0 29.9475 0C14.2009 0 1.28296 12.0898 0 27.4781H39.7222V32.5216H0C1.28296 47.9102 14.2009 60 29.9475 60Z"
        fill="#E3E7E9"
      />
    </svg>
  );
};
