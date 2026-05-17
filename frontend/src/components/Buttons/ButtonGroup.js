import React from "react";

const ButtonGroup = ({ buttons }) => (
  <div className="inline-flex rounded-md shadow-sm" role="group">
    {buttons.map((button, index) => (
      <button
        key={index}
        type="button"
        onClick={button.onClick}
        className={`inline-flex items-center px-4 py-2 text-sm font-medium text-gray-900 bg-white 
          ${
            index === 0
              ? "rounded-l-lg"
              : index === buttons.length - 1
              ? "rounded-r-md"
              : ""
          } 
          border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 
          focus:ring-blue-700 focus:text-blue-700 dark:bg-gray-700 dark:border-gray-600 dark:text-white 
          dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-blue-500 dark:focus:text-white`}
      >
        {button.icon}
        {button.buttonName}
      </button>
    ))}
  </div>
);

export default ButtonGroup;

// const initialState = { /* your initial state here */ };

// function reducer(state, action) {
//   switch (action.type) {
//     case 'profile':
//       // Add your state update logic for profile button click
//       return updatedStateProfile;
//     case 'settings':
//       // Add your state update logic for settings button click
//       return updatedStateSettings;
//     case 'downloads':
//       // Add your state update logic for downloads button click
//       return updatedStateDownloads;
//     default:
//       throw new Error();
//   }
// }

// const MyComponent = () => {
//   const [state, dispatch] = useReducer(reducer, initialState);

//   return (
//     <ButtonGroup
//       buttons={[
//         {
//           buttonName: 'Profile',
//           icon: <Icon1 />,
//           onClick: () => dispatch({ type: 'profile' })
//         },
//         {
//           buttonName: 'Settings',
//           icon: <Icon2 />,
//           onClick: () => dispatch({ type: 'settings' })
//         },
//         {
//           buttonName: 'Downloads',
//           icon: <Icon3 />,
//           onClick: () => dispatch({ type: 'downloads' })
//         },
//       ]}
//     />
//   );
// };

// export default MyComponent;
