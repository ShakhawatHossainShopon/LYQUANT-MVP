import { createBrowserRouter, RouterProvider } from "react-router-dom";

// Page components
import Dashboard from "@/pages/Dashboard";
import Portfolio from "@/pages/Portfolio";
import Positions from "@/pages/Positions";
import ExitPositions from "@/pages/ExitPositions";
import News from "@/pages/News";
import Correlation from "@/pages/Correlation";
import AssetList from "@/pages/AssetList";
import MyAssets from "@/pages/MyAssets";
import Charts from "@/pages/Charts";
import RiskManagement from "@/pages/RiskManagement";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Define the router structure
const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      {
        path: "/",
        element: <Dashboard />,
      },
      {
        path: "/portfolio",
        element: <Portfolio />,
      },
      {
        path: "/positions",
        element: <Positions />,
      },
      {
        path: "/all-positions",
        element: <Positions />,
      },
      {
        path: "/risk-management",
        element: <RiskManagement />,
      },
      {
        path: "/exit-positions",
        element: <ExitPositions />,
      },
      {
        path: "/news",
        element: <News />,
      },
      {
        path: "/correlation",
        element: <Correlation />,
      },
      {
        path: "/assets",
        element: <AssetList />,
      },
      {
        path: "/my-assets",
        element: <MyAssets />,
      },
      {
        path: "/charts",
        element: <Charts />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
