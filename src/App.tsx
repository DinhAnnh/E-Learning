import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContent';
import { PrivateRoute } from './components/PrivateRoute';

import { StudentPage } from './pages/StudentPage';
import { TeacherPage } from './pages/TeacherPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes - Student */}
          <Route 
            path="/student" 
            element={
              <PrivateRoute allowedRoles={['student']}>
                <StudentPage />
              </PrivateRoute>
            } 
          />

          {/* Protected routes - Teacher */}
          <Route 
            path="/teacher" 
            element={
              <PrivateRoute allowedRoles={['teacher']}>
                <TeacherPage />
              </PrivateRoute>
            } 
          />

          {/* Protected routes - Admin */}
          <Route 
            path="/admin" 
            element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminPage />
              </PrivateRoute>
            } 
          />

          {/* Default redirect based on authentication */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
