import React from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

/**
 * Sparkline — minimal inline trend chart (Recharts) with no axes/gridlines,
 * sized roughly 100px wide x 32px tall. Used in the "Your Stats" card to show
 * service hours logged over recent weeks.
 *
 * TODO(sparkline-data): The backend does not yet return historical weekly hours.
 * Replace the placeholder array with a real MongoDB aggregation that groups
 * CommunityService/Attendance records by week for the logged-in student, e.g.:
 *   Attendance.aggregate([
 *     { $match: { student: userId, communityServiceHours: { $gt: 0 } } },
 *     { $group: { _id: { $week: "$attendedAt" }, hours: { $sum: "$communityServiceHours" } } },
 *     { $sort: { _id: 1 } }
 *   ])
 */
const Sparkline = ({
  data = [2, 3, 1.5, 4, 3.5, 5, 4.5],
  color = "#ef4444",
  className = "",
  height = 32,
}) => {
  const chartData = data.map((value) => ({ value }));

  return (
    <div className={`h-8 w-24 ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#sparkFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Sparkline;
