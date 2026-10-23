import { useEffect, useState } from "react";
import reportService from "../objectives/reportService";

// The signed in user's OKR permissions, or null while loading
function useMyPermissions(token) {
  const [permissions, setPermissions] = useState(null);

  useEffect(() => {
    let active = true;
    if (!token) return undefined;
    reportService
      .getMyPermissions(token)
      .then((list) => {
        if (active) setPermissions(list);
      })
      .catch(() => {
        if (active) setPermissions([]);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return permissions;
}

export default useMyPermissions;
