import React from "react";

const InputField = ({ placeholder, valueGetter, valueSetter }) => {
  return (
    <div className="flex flex-col mb-4">
      <input
        type="text"
        placeholder={placeholder}
        className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={valueGetter()}
        onChange={(e) => valueSetter(e.target.value)}
      />
    </div>
  );
};

export default InputField;

{
  /* <InputField placeholder="Name" valueGetter={() => name} valueSetter={setName} /> */
}
