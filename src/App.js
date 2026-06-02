import React, { useState } from "react";
import TattooBookingApp from "./TattooBookingApp";
import AdminDashboard from "./AdminDashboard";
import { supabase } from "./supabaseClient";
export default function App() {
  const [view, setView] = useState("client");

  return (
    <div className="relative">
      {/* Secret Admin Toggle */}
      AdminDashboard
      {view === "client" ? <TattooBookingApp /> : <TattooBookingApp />}
    </div>
  );
}
