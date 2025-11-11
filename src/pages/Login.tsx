import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContent';
import { motion } from 'framer-motion';
import { get, ref } from 'firebase/database';
import type { FirebaseError } from 'firebase/app';
import { realtimeDb } from '../config/firebase';
import type { UserRole } from '../types';

interface DemoAccount {
  email: string;
  password: string;
  role: UserRole;
  name?: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Học sinh',
  teacher: 'Giáo viên',
  admin: 'Admin',
};

const ROLE_ROUTES: Record<UserRole, string> = {
  student: '/student',
  teacher: '/teacher',
  admin: '/admin',
};

const DEMO_ACCOUNT_FALLBACKS: DemoAccount[] = [
  { role: 'student', email: 'student@demo.com', password: 'password123' },
  { role: 'teacher', email: 'teacher@demo.com', password: 'password123' },
  { role: 'admin', email: 'admin@demo.com', password: 'password123' },
];

const mapToDemoAccount = (item: unknown): DemoAccount | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  const role = record.role;
  const email = record.email;
  const password = record.password;
  const name = record.name;

  if (role !== 'student' && role !== 'teacher' && role !== 'admin') {
    return null;
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return null;
  }

  const trimmedName = typeof name === 'string' ? name.trim() : '';

  return {
    role,
    email,
    password,
    name: trimmedName.length > 0 ? trimmedName : undefined,
  } satisfies DemoAccount;
};

const useDemoAccounts = () => {
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [loadingDemoAccounts, setLoadingDemoAccounts] = useState(true);

  useEffect(() => {
    let isSubscribed = true;

    const fetchDemoAccounts = async () => {
      try {
        setLoadingDemoAccounts(true);
        const snapshot = await get(ref(realtimeDb, 'users'));

        if (!isSubscribed) {
          return;
        }

        if (snapshot.exists()) {
          const rawData = snapshot.val();
          const accountsArray = Array.isArray(rawData)
            ? rawData
            : Object.values(rawData ?? {});

          const formattedAccounts = accountsArray
            .map(mapToDemoAccount)
            .filter((account): account is DemoAccount => account !== null);

          setDemoAccounts(formattedAccounts);
        } else {
          setDemoAccounts([]);
        }
      } catch (err) {
        console.error('Failed to fetch demo accounts:', err);
        if (isSubscribed) {
          setDemoAccounts([]);
        }
      } finally {
        if (isSubscribed) {
          setLoadingDemoAccounts(false);
        }
      }
    };

    void fetchDemoAccounts();

    return () => {
      isSubscribed = false;
    };
  }, []);

  return { demoAccounts, loadingDemoAccounts };
};

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();
  const { demoAccounts, loadingDemoAccounts } = useDemoAccounts();

  useEffect(() => {
    if (currentUser) {
      navigate(ROLE_ROUTES[currentUser.role], { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    let isSubscribed = true;

    const fetchDemoAccounts = async () => {
      try {
        setLoadingDemoAccounts(true);
        const snapshot = await get(ref(realtimeDb, 'users'));

        if (!isSubscribed) {
          return;
        }

        if (snapshot.exists()) {
          const rawData = snapshot.val();
          const accountsArray = Array.isArray(rawData)
            ? rawData
            : Object.values(rawData ?? {});

          const formattedAccounts: DemoAccount[] = accountsArray
            .map((item) => {
              if (!item || typeof item !== 'object') {
                return null;
              }

              const role = (item as Record<string, unknown>).role;
              const email = (item as Record<string, unknown>).email;
              const password = (item as Record<string, unknown>).password;
              const name = (item as Record<string, unknown>).name;

              if (
                role !== 'student' &&
                role !== 'teacher' &&
                role !== 'admin'
              ) {
                return null;
              }

              if (typeof email !== 'string' || typeof password !== 'string') {
                return null;
              }

              return {
                role,
                email,
                password,
                name: typeof name === 'string' && name.trim().length > 0 ? name : undefined,
              } satisfies DemoAccount;
            })
            .filter((account): account is DemoAccount => account !== null);

          setDemoAccounts(formattedAccounts);
        } else {
          setDemoAccounts([]);
        }
      } catch (err) {
        console.error('Failed to fetch demo accounts:', err);
        if (isSubscribed) {
          setDemoAccounts([]);
        }
      } finally {
        if (isSubscribed) {
          setLoadingDemoAccounts(false);
        }
      }
    };

    void fetchDemoAccounts();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (err) {
      const error = err as Partial<FirebaseError> & { code?: string };
      console.error('Login error:', err);
      if (error.code === 'auth/user-not-found') {
        setError('Tài khoản không tồn tại');
      } else if (error.code === 'auth/wrong-password') {
        setError('Mật khẩu không đúng');
      } else if (error.code === 'auth/invalid-email') {
        setError('Email không hợp lệ');
      } else {
        setError('Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">E-Learning Academy</h1>
          <p className="text-gray-600">Đăng nhập để tiếp tục</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                placeholder="example@email.com"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Chưa có tài khoản?{' '}
              <Link 
                to="/register" 
                className="text-blue-600 hover:text-blue-700 font-semibold transition"
              >
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>

        {/* Demo accounts info */}
        <div className="mt-6 bg-white/60 backdrop-blur-sm rounded-xl p-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">Tài khoản demo:</p>
          <div className="space-y-2 text-sm text-gray-600">
            {loadingDemoAccounts ? (
              <p>Đang tải danh sách tài khoản...</p>
            ) : demoAccounts.length > 0 ? (
              demoAccounts.map((account) => (
                <div key={`${account.role}-${account.email}`} className="space-y-1">
                  <p>
                    • {ROLE_LABELS[account.role]}: {account.email} / {account.password}
                  </p>
                  {account.name && (
                    <p className="text-xs text-gray-500 ml-4">Tên hiển thị: {account.name}</p>
                  )}
                </div>
              ))
            ) : (
              <>
                {DEMO_ACCOUNT_FALLBACKS.map((account) => (
                  <p key={account.role}>
                    • {ROLE_LABELS[account.role]}: {account.email} / {account.password}
                  </p>
                ))}
                <p className="text-xs text-gray-500">Không thể tải dữ liệu demo từ Firebase. Hiển thị thông tin mặc định.</p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
