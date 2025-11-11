import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContent';
import type { UserRole } from '../types';


interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const PrivateRoute = ({ children, allowedRoles }: PrivateRouteProps) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to appropriate page based on user role
    if (currentUser.role === 'student') {
      return <Navigate to="/student" replace />;
    } else if (currentUser.role === 'teacher') {
      return <Navigate to="/teacher" replace />;
    } else {
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};
