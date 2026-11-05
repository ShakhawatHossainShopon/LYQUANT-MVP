import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  PieChart,
  Activity,
  ShieldAlert,
  Bookmark,
  LineChart,
  Radio,
  History,
  GitCommit,
  Layers,
  Clock,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { NAVIGATION_CONFIG } from "./../config/navigationConfig";

const ICON_MAP = {
  LayoutDashboard,
  PieChart,
  Activity,
  ShieldAlert,
  Bookmark,
  LineChart,
  Radio,
  History,
  GitCommit,
  Layers,
  Clock,
};

export const Sidebar = () => {
  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white/95 backdrop-blur-sm p-4 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)] select-none">
      <nav className="space-y-1">
        <div className="px-3 pb-2.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          Navigation
        </div>

        {NAVIGATION_CONFIG.links.map((link) => {
          const IconComponent = ICON_MAP[link.iconName] || HelpCircle;

          return (
            <NavLink
              key={link.name}
              to={link.href}
              className={({ isActive }) =>
                `group relative w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 ease-out cursor-pointer active:scale-[0.98] ${
                  isActive
                    ? "bg-slate-900 text-white shadow-sm shadow-slate-900/10"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 ${
                        isActive
                          ? "bg-slate-800 text-white"
                          : "text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/60"
                      }`}
                    >
                      <IconComponent className="w-4 h-4 shrink-0" />
                    </div>
                    <span className="truncate">{link.name}</span>
                  </div>

                  {isActive ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-xs" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-150" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-100 space-y-2 px-1">
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-slate-500 font-medium font-sans">
              MT5 Status
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-700">
            Connected
          </span>
        </div>

        <div className="px-2 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>Environment</span>
          <span className="font-mono text-slate-600 font-semibold">
            {NAVIGATION_CONFIG.environment} ({NAVIGATION_CONFIG.accountType})
          </span>
        </div>
      </div>
    </aside>
  );
};
