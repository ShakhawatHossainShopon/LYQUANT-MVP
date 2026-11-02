import React from "react";
import { Outlet } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/Sidebar";

export const DashboardLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col font-sans antialiased text-slate-900 selection:bg-indigo-500 selection:text-white">
      <Header />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-6 overflow-y-auto transition-opacity duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
