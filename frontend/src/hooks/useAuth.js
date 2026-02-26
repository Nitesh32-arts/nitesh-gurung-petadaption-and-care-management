import { useContext } from "react";
import { AuthContext } from "../components/AuthContext.jsx";

export const useAuth = () => useContext(AuthContext);


