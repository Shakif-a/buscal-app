/**
 * EmployeeDashboardContent.js — Business Calendar standalone repo
 *
 * Compact card layout. Cards are small and grouped, not full-screen.
 * OKR card included — links to /dashboard/okr when ready.
 */
import React from "react";
import { useSelector } from "react-redux";

const cardData = [
  {
    link: "/dashboard/business-calendar",
    image: "/images/icons/calendar.svg",
    title: "Business Calendar",
    description: "View repetitive or one-off tasks to be completed.",
    actionText: "Open",
    accent: "#6366f1",
  },
  {
    link: "/dashboard/okrtracker/okrdashboard",
    image: "/images/icons/roadmap.svg",
    title: "OKR",
    description:
      "Link strategic objectives to calendar tasks and track key results.",
    actionText: "Open",
    accent: "#0ea5e9",
  },
  {
    link: "/dashboard/settings",
    image: "/images/icons/account-settings.svg",
    title: "Settings",
    description: "Update your account information and preferences.",
    actionText: "Open",
    accent: "#64748b",
  },
];

export default function EmployeeDashboardContent() {
  const { user } = useSelector((state) => state.auth);
  const userRoles = user?.roles || [];

  return (
    <>
      <style>{`
        .module-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          padding: 24px;
          max-width: 1300px;
          margin: 0 auto;
          box-sizing: border-box;
        }

        .module-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 30px 24px;
          min-height: 280px;
          box-sizing: border-box;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #fff;
          text-decoration: none;
          color: inherit;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          transition: box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
          cursor: pointer;
        }

        .module-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          transform: translateY(-2px);
          border-color: var(--card-accent);
          text-decoration: none;
          color: inherit;
        }

        .module-card:hover .module-action {
          color: var(--card-accent);
        }

        .module-icon-wrap {
          flex-shrink: 0;
          width: 90px;
          height: 90px;
          border-radius: 12px;
          background: var(--card-accent-bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .module-icon-wrap img {
          width: 65px;
          height: 65px;
          object-fit: contain;
        }

        .module-text {
          width: 100%;
          min-width: 0;
          text-align: center;
        }

        .module-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 12px 0;
          font-family: 'DM Sans', sans-serif;
        }

        .module-desc {
          font-size: 14px;
          color: #64748b;
          margin: 0 0 20px 0;
          line-height: 1.5;
          font-family: 'DM Sans', sans-serif;
        }

        .module-action {
          font-size: 14px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-family: 'DM Sans', sans-serif;
          transition: color 0.15s ease;
        }

        .section-label {
          font-size: 28px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #94a3b8;
          padding: 24px 24px 4px;
          margin: 0;
          font-family: 'DM Sans', sans-serif;
        }

        @media (max-width: 900px) {
          .module-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 600px) {
          .module-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <p className="section-label">Modules</p>

      <div className="module-grid">
        {cardData.map((card, index) => {
          if (card.requiredRole && !userRoles.includes(card.requiredRole)) {
            return null;
          }
          const accentRgb = card.accent;
          return (
            <a
              key={index}
              href={card.link}
              className="module-card"
              style={{
                "--card-accent": accentRgb,
                "--card-accent-bg": accentRgb + "15",
              }}
            >
              <div className="module-icon-wrap">
                <img src={card.image} alt={card.title} />
              </div>
              <div className="module-text">
                <p className="module-title">{card.title}</p>
                <p className="module-desc">{card.description}</p>
                <span className="module-action">{card.actionText} →</span>
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}
