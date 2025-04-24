import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface StorageData {
  total: number;
  used: number;
  categories: {
    name: string;
    size: number;
    color: string;
  }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const StorageVisualization: React.FC = () => {
  const [storageData, setStorageData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStorageData = async () => {
      try {
        const response = await fetch('/api/storage/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch storage statistics');
        }
        const data = await response.json();
        setStorageData(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setLoading(false);
      }
    };

    fetchStorageData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Error:</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  if (!storageData) {
    return <div>No storage data available</div>;
  }

  const usedPercentage = Math.round((storageData.used / storageData.total) * 100);
  const freePercentage = 100 - usedPercentage;

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Storage Usage</h2>
      
      <div className="flex flex-col md:flex-row">
        <div className="md:w-1/2">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Used', value: storageData.used },
                  { name: 'Free', value: storageData.total - storageData.used },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                <Cell fill="#8884d8" />
                <Cell fill="#82ca9d" />
              </Pie>
              <Tooltip formatter={(value) => `${formatSize(value as number)}`} />
            </PieChart>
          </ResponsiveContainer>
          
          <div className="text-center">
            <p className="text-lg font-semibold">
              {formatSize(storageData.used)} used of {formatSize(storageData.total)}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-purple-600 h-2.5 rounded-full" 
                style={{ width: `${usedPercentage}%` }}
              ></div>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {freePercentage}% free ({formatSize(storageData.total - storageData.used)})
            </p>
          </div>
        </div>
        
        <div className="md:w-1/2 mt-8 md:mt-0">
          <h3 className="text-xl font-semibold mb-4">Storage Breakdown</h3>
          {storageData.categories.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={storageData.categories}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="size"
                  >
                    {storageData.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${formatSize(value as number)}`} />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="mt-4">
                {storageData.categories.map((category, index) => (
                  <div key={index} className="flex items-center mb-2">
                    <div 
                      className="w-4 h-4 mr-2 rounded" 
                      style={{ backgroundColor: category.color || COLORS[index % COLORS.length] }}
                    ></div>
                    <span className="flex-1">{category.name}</span>
                    <span className="font-medium">{formatSize(category.size)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center mt-10">No category data available</p>
          )}
        </div>
      </div>
      
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Optimization Recommendations</h3>
        <div className="bg-blue-50 p-4 rounded-lg">
          <ul className="list-disc pl-5 space-y-2">
            <li>Remove duplicate images to save approximately {formatSize(storageData.used * 0.05)}</li>
            <li>Compress high-resolution images to save up to {formatSize(storageData.used * 0.2)}</li>
            <li>Create an archive for images you access less frequently</li>
            <li>Consider backing up large collections to external storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default StorageVisualization;