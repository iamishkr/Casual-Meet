import React, { useState } from 'react';
import { useData } from '../../../context/DataContext';
import SafetyScreen from '../../../components/phone/SafetyScreen';

export default function MobileSafetyView() {
  const { activeSos } = useData();
  const [mode, setMode] = useState<'timer' | 'sos'>(activeSos ? 'sos' : 'timer');

  return (
    <div className="rounded-2xl border border-line-soft bg-night-900/90 overflow-hidden shadow-lg p-3">
      <SafetyScreen mode={mode} setMode={setMode} />
    </div>
  );
}
