import { Icon } from "@iconify/react";
import React from "react";
import { useNavigate } from "react-router-dom";

const CustomButton = ({ buttonClass, buttonText, href, icon }) => {
  const navigate = useNavigate();

  const handleClick = (event) => {
    if (!href) {
      event.preventDefault();
      navigate(-1);
    }
  };

  return (
    <a
      href={href || "#"}
      onClick={handleClick}
      className={`flex items-center justify-center ${buttonClass}`}
    >
      {icon ? (
        icon
      ) : (
        <Icon icon="material-symbols:arrow-back" className="text-xl mr-1" />
      )}

      <span className="">{buttonText}</span>
    </a>
  );
};

export default CustomButton;
