import React from "react";
import { Link } from "react-router-dom";

const Button = ({ to, buttonClass, icon, buttonText }) => {
  return (
    <Link to={to}>
      <button className={`flex items-center justify-center ${buttonClass}`}>
        {icon}
        <span className="mx-1">{buttonText}</span>
      </button>
    </Link>
  );
};

export default Button;
