import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import Shell from './components/Shell.jsx';
import { ToastProvider } from './components/ui.jsx';
import { MoveProvider } from './components/MoveFlow.jsx';
import { StoreProvider } from './store.jsx';
import { AuthProvider } from './auth.jsx';
import Overview from './pages/Overview.jsx';
import Candidates from './pages/Candidates.jsx';
import CandidateDetail from './pages/CandidateDetail.jsx';
import Jobs from './pages/Jobs.jsx';
import Interviews from './pages/Interviews.jsx';
import Employees from './pages/Employees.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Feedback from './pages/Feedback.jsx';
import Settings from './pages/Settings.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <MoveProvider>
            <HashRouter>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Overview />} />
                  <Route path="ung-vien" element={<Candidates />} />
                  <Route path="ung-vien/:id" element={<CandidateDetail />} />
                  <Route path="vi-tri" element={<Jobs />} />
                  <Route path="lich-phong-van" element={<Interviews />} />
                  <Route path="nhan-vien" element={<Employees />} />
                  <Route path="onboarding" element={<Onboarding />} />
                  <Route path="phan-hoi" element={<Feedback />} />
                  <Route path="cai-dat" element={<Settings />} />
                  <Route path="*" element={<Overview />} />
                </Route>
              </Routes>
            </HashRouter>
          </MoveProvider>
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  </StrictMode>,
);
