import React from 'react';
import {createRoot} from 'react-dom/client';
import {SpeedInsights} from '@vercel/speed-insights/react';
import Wedding from './Wedding';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <>
    <Wedding />
    <SpeedInsights />
  </>
);