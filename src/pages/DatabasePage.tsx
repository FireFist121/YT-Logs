import React from 'react';
import BannedUsersTable from '../components/database/BannedUsersTable';

export default function DatabasePage() {
  return (
    <div className="flex flex-col h-full p-4">
      <BannedUsersTable />
    </div>
  );
}
