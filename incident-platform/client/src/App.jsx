import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { ProtectedRoute, RoleRoute } from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Incidents from "./pages/Incidents.jsx";
import NewIncident from "./pages/NewIncident.jsx";
import IncidentDetail from "./pages/IncidentDetail.jsx";
import SlaSettings from "./pages/SlaSettings.jsx";
import Users from "./pages/Users.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="incidents" element={<Incidents />} />
        <Route
          path="incidents/new"
          element={
            <RoleRoute roles={["admin", "analyst"]}>
              <NewIncident />
            </RoleRoute>
          }
        />
        <Route path="incidents/:id" element={<IncidentDetail />} />
        <Route path="sla" element={<SlaSettings />} />
        <Route
          path="users"
          element={
            <RoleRoute roles={["admin"]}>
              <Users />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
