import React from 'react';
import ReactDOM from 'react-dom/client';
import { CandyFlowApp } from './CandyFlowApp';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element.');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <CandyFlowApp />
  </React.StrictMode>,
);
