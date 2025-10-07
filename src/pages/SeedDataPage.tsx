import React, { useState } from 'react';
import { seedTestData } from '../utils/seedData';
import toast from 'react-hot-toast';

const SeedDataPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const handleSeedData = async () => {
    setLoading(true);
    try {
      await seedTestData();
      setSeeded(true);
      toast.success('Test data seeded successfully!');
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Error seeding test data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Seed Test Data
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Create test accounts for development
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Test Accounts</h3>
          
          <div className="space-y-3 text-sm">
            <div className="border-l-4 border-blue-500 pl-3">
              <div className="font-medium">Admin Account</div>
              <div className="text-gray-600">admin@shoutout.com / password123</div>
            </div>
            
            <div className="border-l-4 border-green-500 pl-3">
              <div className="font-medium">Talent Account</div>
              <div className="text-gray-600">tucker@shoutout.com / password123</div>
              <div className="text-xs text-gray-500">Tucker Carlson - TV Host</div>
            </div>
            
            <div className="border-l-4 border-purple-500 pl-3">
              <div className="font-medium">User Accounts</div>
              <div className="text-gray-600">john@example.com / password123</div>
              <div className="text-gray-600">corp@company.com / password123</div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleSeedData}
              disabled={loading || seeded}
              className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Accounts...' : seeded ? 'Accounts Created!' : 'Create Test Accounts'}
            </button>
          </div>

          {seeded && (
            <div className="mt-4 p-4 bg-green-50 rounded-md">
              <div className="text-sm text-green-800">
                ✅ Test accounts created successfully! You can now sign in with the accounts above.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SeedDataPage;
