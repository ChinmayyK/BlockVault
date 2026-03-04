import React from 'react';

interface ScrollingTextProps {
  text: string;
  className?: string;
}

export const ScrollingText: React.FC<ScrollingTextProps> = ({ text, className = '' }) => {
  return (
    <span 
      className={`gradient-fade-text ${className}`} 
      title={text}
    >
      {text}
    </span>
  );
};
