import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Hotel, Crown, Briefcase, Headphones } from 'lucide-react';

const demoAccounts = [
  {
    email: 'admin@hotelpramod.local',
    password: 'Admin@123',
    role: 'Super Admin',
    hint: 'Full system',
    icon: <Crown className="w-5 h-5" />,
    color: 'from-purple-500 to-pink-500',
  },
  {
    email: 'gm@hotelpramod.local',
    password: 'Admin@123',
    role: 'General Manager',
    hint: 'Leadership dashboard',
    icon: <Briefcase className="w-5 h-5" />,
    color: 'from-slate-700 to-indigo-800',
  },
  {
    email: 'agent@hotelpramod.local',
    password: 'Admin@123',
    role: 'Sales Agent',
    hint: 'Simple home — same powers',
    icon: <Headphones className="w-5 h-5" />,
    color: 'from-emerald-600 to-teal-600',
  },
];

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      {/* Animated background effect */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <div className="w-full max-w-5xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left side - Branding */}
          <div className="text-white space-y-6 hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-2xl">
                <Hotel className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Hotel Pramod</h1>
                <p className="text-purple-200">Sales CRM + CRS Platform</p>
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">🎯</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Comprehensive Sales Dashboard</h3>
                  <p className="text-purple-200 text-sm">Track revenue, bookings, and team performance in real-time</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Advanced Analytics</h3>
                  <p className="text-purple-200 text-sm">Make data-driven decisions with powerful insights</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-2xl">🚀</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Complete CRM + CRS Solution</h3>
                  <p className="text-purple-200 text-sm">Manage reservations, leads, and customer relationships</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Login Form */}
          <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4 lg:hidden">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
                  <Hotel className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>Sign in to access your dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or try demo accounts</span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {demoAccounts.map((account, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDemoLogin(account.email, account.password)}
                    className={`p-4 rounded-xl border-2 border-transparent hover:shadow-lg transition-all group bg-gradient-to-br ${account.color} hover:scale-[1.02] text-left`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-white">
                        {account.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">{account.role}</p>
                        <p className="text-[11px] text-white/75 truncate">{account.email}</p>
                        <p className="text-[11px] text-white/90 mt-1">{account.hint}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-xs text-center text-gray-500">
                Same password for all: Admin@123 — run <code className="text-gray-700">npm run db:seed</code> in backend if a login fails.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;