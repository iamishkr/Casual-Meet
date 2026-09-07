import React from 'react';
import { useNavigate } from 'react-router-dom';
import DiscoverScreen from '../../../components/phone/DiscoverScreen';

export default function MobileDiscoverView() {
  const navigate = useNavigate();

  return (
    <div className="h-full">
      <DiscoverScreen goChat={() => navigate('/mobile/messages')} />
    </div>
  );
}
