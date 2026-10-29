import React from 'react';
import ReactDOM from 'react-dom/client';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

import App from './App';
import AcessibilidadeMenu from './components/AcessibilidadeMenu';
import './index.css';
import './compact.css';
import './acessibilidade.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <AcessibilidadeMenu />
  </React.StrictMode>
);