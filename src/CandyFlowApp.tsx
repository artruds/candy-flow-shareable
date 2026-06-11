import React, { useEffect } from 'react';
import { SmoothSailing } from './components/CandyFlow';

export const CandyFlowApp: React.FC = () => {
  useEffect(() => {
    document.title = 'Candy Flow';
  }, []);

  return <SmoothSailing />;
};
