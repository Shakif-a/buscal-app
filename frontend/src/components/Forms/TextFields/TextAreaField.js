import React from "react";

const TextAreaField = ({ placeholder, valueGetter, valueSetter, rows }) => {
  const value = valueGetter(); // get the current value from the valueGetter function

  const handleChange = (e) => {
    const newValue = e.target.value; // get the new value from the event object
    valueSetter(newValue); // set the new value using the valueSetter function
  };

  return (
    <div className="flex flex-col mb-4">
      <textarea
        placeholder={placeholder}
        className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={rows}
        value={value || ""} // make sure value is always a string and set a default value if it's undefined or null
        onChange={handleChange} // use the handleChange function to update the value
      />
    </div>
  );
};

export default TextAreaField;

{
  /* <InputField placeholder="Enter your message" valueGetter={getMessage} valueSetter={setMessage} rows={5} /> */
}
