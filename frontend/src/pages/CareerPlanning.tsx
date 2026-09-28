import { NavLink, Outlet } from "react-router-dom";
import { PageHeader } from "../components/UI";
export function CareerPlanning() {
  return (
    <>
      <PageHeader
        eyebrow="Your next step"
        title="Career planning"
        description="Choose a target role, compare your experience and explore a practical learning plan."
      />
      <nav className="tabs" aria-label="Career planning sections">
        <NavLink to="/planning/roles">Target roles & skill gaps</NavLink>
        <NavLink to="/planning/actions">What-if & action plan</NavLink>
        <NavLink to="/planning/trends">Market trends</NavLink>
      </nav>
      <div className="embedded-page">
        <Outlet />
      </div>
    </>
  );
}
