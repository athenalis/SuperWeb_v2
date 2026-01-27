import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SuaraCharts({ summary }) {
  const data = {
    labels: summary.labels,
    datasets: [
      {
        data: summary.values,
        backgroundColor: ["#2196F3", "#00E396", "#FEB019"],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h3 className="font-semibold mb-4 text-center">
        Distribusi Suara Paslon
      </h3>

      <div className="h-[360px] flex justify-center">
        <Doughnut data={data} />
      </div>
    </div>
  );
}
  