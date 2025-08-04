import React, { useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';

const SalesChart = () => {
  const chartRef = useRef(null);

  useEffect(() => {
    const options = {
      series: [{
        name: 'Net Sales',
        data: [30000, 40000, 35000, 50000, 49000, 60000, 70000]
      }],
      chart: {
        height: 300,
        type: 'area',
        toolbar: { show: false }
      },
      colors: ['#0d6efd'],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      xaxis: {
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']
      }
    };

    const chart = new ApexCharts(chartRef.current, options);
    chart.render();

    return () => chart.destroy();
  }, []);

  return <div id="revenue-chart" ref={chartRef}></div>;
};

export default SalesChart;