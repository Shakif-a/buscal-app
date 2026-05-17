import { Button } from "antd";

export const BackButton = () => {
  return (
    <Button
      type="default"
      className="flex items-center py-2 text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:border-blue-700 focus:ring focus:ring-blue-200"
      onClick={() => {
        window.history.back();
      }}
    >
      {/* SVG for the left-pointing back arrow */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 -ml-1.5" // Added ml-1 to make the icon closer to the button edge
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M9.707 16.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L6.414 10l3.293 3.293a1 1 0 010 1.414z"
          clipRule="evenodd"
        />
      </svg>
      Back
    </Button>
  );
};
