import { useState } from "react";
import { User, Home, Stethoscope } from "lucide-react";

const roles = [
  {
    id: "adopter",
    label: "Adopter",
    icon: User,
  },
  {
    id: "shelter",
    label: "Shelter",
    icon: Home,
  },
  {
    id: "veterinarian",
    label: "Veterinarian",
    icon: Stethoscope,
  },
];

const RoleSelector = ({ value, onChange }) => {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">I am a:</p>

      {/* Single row on sm+; equal-width, equal-height cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
        {roles.map((role) => {
          const Icon = role.icon;
          const selected = value === role.id;
          const isHovered = hovered === role.id;

          const base =
            "flex h-28 w-full flex-col items-center justify-center rounded-xl border text-sm transition-colors transition-shadow cursor-pointer";
          const inactive =
            "bg-white border-gray-200 shadow-none";
          const active =
            "bg-emerald-50 border-2 border-primary shadow-md";
          const hover =
            !selected && isHovered
              ? "border-primary bg-emerald-50"
              : "";

          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onChange(role.id)}
              onMouseEnter={() => setHovered(role.id)}
              onMouseLeave={() => setHovered(null)}
              className={[base, selected ? active : inactive, hover].join(" ")}
            >
              {/* Icon */}
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white mb-2">
                <Icon className="w-5 h-5" />
              </div>

              {/* Label */}
              <span className="text-sm font-semibold text-gray-900 text-center">
                {role.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RoleSelector;

