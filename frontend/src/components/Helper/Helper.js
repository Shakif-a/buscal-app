import moment from "moment";

//---------------------------ARRAYS---------------------------

//---------

export function sortArrayByMultipleKeys(array, ...keysAndOrders) {
  const keys = keysAndOrders.filter((_, index) => index % 2 === 0);
  const orders = keysAndOrders.filter((_, index) => index % 2 === 1);

  function getDateValue(dateString) {
    try {
      const match = dateString?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);

      if (match) {
        const year = parseInt(match[3], 10) >= 100 ? match[3] : `20${match[3]}`;
        const month = parseInt(match[2], 10) - 1;
        const day = parseInt(match[1], 10);
        return new Date(year, month, day);
      }
    } catch (error) {}

    return dateString;
  }

  return array.sort((a, b) => {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const order = orders[i] || "asc"; // default to ascending order

      const valA = getDateValue(a[key]);
      const valB = getDateValue(b[key]);

      let compareResult = 0;

      if (valA < valB) {
        compareResult = -1;
      } else if (valA > valB) {
        compareResult = 1;
      }

      if (order === "desc") {
        compareResult *= -1; // reverse the sort order if 'desc' is specified
      }

      if (compareResult !== 0) {
        return compareResult; // return the comparison result if non-zero
      }
    }

    return 0; // return zero if all keys are equal
  });
}

// const mySortedArray = sortArrayByMultipleKeys(
//   filteredArray,
//   'salesEmployee', 'desc'
//   "age", 'asc'
// );

//---------

export function getArrayOfUniqueValues(array, key) {
  const uniqueValues = [];
  array.forEach((item) => {
    if (!uniqueValues.includes(item[key])) {
      uniqueValues.push(item[key]);
    }
  });
  return uniqueValues;
}

//---------

export function filterArrayByKeyValuePair(arr, key, value) {
  return arr.filter((item) => item[key] === value);
}

// const filteredArray = filterArrayByKeyValuePair(array, "age", 30);

//---------

export function updateKeyValueInArrayByFunction(arr, keyName, updateFn) {
  return arr.map((obj) => {
    return {
      ...obj,
      [keyName]: updateFn(obj[keyName]),
    };
  });
}

// const updatedData = updateKeyInArray(array, 'date', stringToDate)

//---------

export function sortStringArrayKeepingFirstIndexValue(arr, firstValue) {
  arr.sort((a, b) => {
    if (a === firstValue) return -1; // keep firstValue at the beginning
    if (b === firstValue) return 1; // keep firstValue at the beginning
    return a.localeCompare(b); // sort other elements alphabetically
  });
  return arr;
}

// const array = sortStringArrayKeepingFirstIndexValue(array, 'banana');

//---------------------------CONVERSIONS---------------------------

//---------

export function stringToNum(value, decimal) {
  try {
    var num;
    if (!value) {
      return null;
    } else if (value?.indexOf(",") > -1) {
      //if string contains comma, remove it
      num = parseFloat(value.replace(/,/g, ""), 10).toFixed(decimal);
      //convert string to num (remains string because of .toFixed)
      return Number(num);
    } else {
      num = parseFloat(value, 10).toFixed(decimal);
      return Number(num);
    }
  } catch (error) {
    console.log("Error converting string to number");
    return value;
  }
}

//---------

export function convertKeysToNumberFormat(array, keys) {
  const newArray = array.map((item) => {
    const newItem = { ...item };
    keys.forEach((key) => {
      newItem[key] = Number(newItem[key]);
    });
    return newItem;
  });
  return newArray;
}

//---------

export function convertNumbersInArrayTo2DecimalPlaces(array) {
  const newData = array.map((obj) => {
    const newObj = {};
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "number") {
        newObj[key] = parseFloat(obj[key].toFixed(2));
      } else {
        newObj[key] = obj[key];
      }
    });
    return newObj;
  });

  return newData;
}

//---------

export function convertNumbersInArrayToIncludeComma(array) {
  const newData = array.map((item) => {
    const formattedItem = {};
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === "number") {
        formattedItem[key] = value.toLocaleString();
      } else {
        formattedItem[key] = value;
      }
    }
    return formattedItem;
  });

  return newData;
}

//---------

export const formatNumberWithCommas = (number) => {
  return new Intl.NumberFormat().format(number);
};

//---------

export function convertNumberToIncludeComma(number) {
  if (typeof number !== "number") return number;
  return number.toLocaleString();
}

//---------------------------DATES---------------------------

//---------

export function stringToDate(value) {
  //moment object date
  const date = moment(value, "DD/MM/YYYY");

  //convert moment obj to js date
  var d = date.toDate();

  //shortern date
  d = d.toLocaleDateString("en-AU");

  //console.log(d.toLocaleDateString('en-AU'));
  return d;
}

//---------

export function getDateMonth(value) {
  var check = moment(value, "DD/MM/YYYY");
  //var day   = check.format('D');
  var month = check.format("M");
  //var year  = check.format('YYYY');

  return month;
}

//---------

export function getDateYear(value) {
  var check = moment(value, "DD/MM/YYYY");
  var year = check.format("YYYY");

  return year;
}

//---------

export function getMonthDifference(d1, d2) {
  var date1 = moment(d1, "DD/MM/YYYY");
  var date2 = moment(d2, "DD/MM/YYYY");

  var monthsDate1 = Number(date1.format("MM"));
  var yearsDate1 = Number(date1.format("YYYY"));

  var monthsDate2 = Number(date2.format("MM"));
  var yearsDate2 = Number(date2.format("YYYY"));

  var startMonth = monthsDate1 + yearsDate1 * 12;
  var endMonth = monthsDate2 + yearsDate2 * 12;

  var monthDifference = endMonth - startMonth;

  return monthDifference;
}

//---------

export function dateIsGreater(date1, date2) {
  var isGreater = moment(date1, "DD-MM-YYYY") > moment(date2, "DD-MM-YYYY");
  return isGreater;
}

//---------

export function dateToAusDate(d) {
  d = new Date(d);
  const yyyy = d.getFullYear();
  let mm = d.getMonth() + 1; // Months start at 0!
  let dd = d.getDate();

  if (dd < 10) dd = "0" + dd;
  if (mm < 10) mm = "0" + mm;

  const formattedDate = dd + "/" + mm + "/" + yyyy;

  return formattedDate;
}

//---------

export function getCurrentFinancialYear() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // In JavaScript, the month is 0-indexed (January is 0, February is 1, ..., June is 5, July is 6)

  if (month >= 6) {
    // If the current month is July or later
    return year + 1; // The financial year is the same as the current year
  } else {
    // If the current month is before July
    return year; // The financial year is the previous year
  }
}

//--------- OTHER

export const displayValueOrNA = (value) => {
  return value ? value : "N/A";
};
