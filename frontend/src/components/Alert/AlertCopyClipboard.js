import { Icon } from "@iconify/react";
import { useState } from "react";

const AlertCopyClipboard = ({ message, position = "center" }) => {
  const [visible, setVisible] = useState(true);

  const handleCloseAlert = () => {
    setVisible(false);
  };

  const getPositionClasses = () => {
    switch (position) {
      case "center":
        return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
      case "top":
        return "top-0 left-1/2 -translate-x-1/2";
      case "left":
        return "top-1/2 left-0 -translate-y-1/2";
      case "right":
        return "top-1/2 right-0 -translate-y-1/2";
      case "bottom":
        return "bottom-0 left-1/2 -translate-x-1/2";
      default:
        return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    }
  };

  return visible ? (
    <div
      className={`fixed mb-4 flex ${getPositionClasses()} rounded-lg bg-green-300 p-4 text-base text-green-800 dark:bg-gray-700 dark:text-green-400 z-50`}
      role="alert"
    >
      <Icon icon="mdi:information-variant-circle" className="text-2xl mr-2" />
      <div>
        <span className="font-medium text-green-800">Copied to clipboard!</span>
      </div>

      <button
        className="min-w-min ml-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-600 focus:outline-none"
        onClick={handleCloseAlert}
      >
        <Icon icon="material-symbols:close" />
      </button>
    </div>
  ) : null;
};

export default AlertCopyClipboard;
