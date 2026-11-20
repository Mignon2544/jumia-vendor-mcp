import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Lock, ArrowRight } from 'lucide-react';

export default function Login({ onLogin }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Please enter your MCP API Token');
      return;
    }
    // Save token to browser storage and proceed
    localStorage.setItem('wizo_token', token);
    onLogin(token);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-darkBg">
      {/* Background Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand rounded-full mix-blend-screen filter blur-[150px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[150px] opacity-40 animate-pulse"></div>

      {/* Glassmorphism Login Card */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md p-10 bg-panelBg backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-brand to-yellow-300 rounded-full flex items-center justify-center mb-4 shadow-glow">
            <ShoppingBag size={32} className="text-darkBg" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wide">Wizo Seller Hub</h1>
          <p className="text-gray-400 mt-2 text-sm">Enter your API token to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => { setToken(e.target.value); setError(''); }}
                className="w-full pl-10 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
                placeholder="MCP_API_TOKEN"
              />
            </div>
            {error && <p className="text-red-400 text-xs mt-2 ml-1">{error}</p>}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full flex items-center justify-center py-3 px-4 bg-brand hover:bg-yellow-500 text-darkBg font-bold rounded-xl transition-all shadow-glow"
          >
            Access Dashboard
            <ArrowRight size={18} className="ml-2" />
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}