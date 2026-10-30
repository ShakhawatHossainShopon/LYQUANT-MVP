import React from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { NAVIGATION_CONFIG } from "./../config/navigationConfig";

export const Sidebar = () => {
  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <nav className="space-y-1.5">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu
        </div>
        {NAVIGATION_CONFIG.links.map((link) => {
          const IconComponent = Icons[link.iconName] || Icons.HelpCircle;

          return (
            <NavLink
              key={link.name}
              to={link.href}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <IconComponent
                    className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`}
                  />
                  <span>{link.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-slate-100 px-3 flex items-center justify-between text-xs text-slate-400">
        <span>Environment</span>
        <span className="font-mono text-slate-600 font-medium">
          {NAVIGATION_CONFIG.environment} ({NAVIGATION_CONFIG.accountType})
        </span>
      </div>
    </aside>
  );
};
