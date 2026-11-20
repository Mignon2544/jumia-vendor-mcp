import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Package, LogOut, Loader2, AlertCircle, UploadCloud } from 'lucide-react';
import Products from './Products';
import Importer from './Importer';

export default function Dashboard({ token, onLogout }) {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchShops();
    }
  }, [activeTab]);

  const fetchShops = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://jumia-vendor-mcp.onrender.com/api/shops', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch shops.');
      const data = await response.json();
      setShops(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-darkBg overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -250 }} animate={{ x: 0 }} transition={{ duration: 0.5 }}
        className="w-64 bg-panelBg border-r border-white/10 backdrop-blur-xl flex flex-col justify-between z-20"
      >
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-white/10">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <Package size={20} className="text-darkBg" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">Wizo Hub</h2>
          </div>
          
          <nav className="p-4 space-y-2 mt-4">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'overview' ? 'bg-brand/10 text-brand border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard size={20} />
              <span className="font-semibold">Overview</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'products' ? 'bg-brand/10 text-brand border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Package size={20} />
              <span>Products</span>
            </button>

            <button 
              onClick={() => setActiveTab('importer')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === 'importer' ? 'bg-brand/10 text-brand border border-brand/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <UploadCloud size={20} />
              <span>Importer</span>
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand/10 rounded-full filter blur-[100px] pointer-events-none"></div>

        <div className="p-8 relative z-10">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              <header className="mb-10">
                <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
                <p className="text-gray-400 mt-1">Here is what's happening with your Jumia stores today.</p>
              </header>

              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-brand">
                  <Loader2 size={40} className="animate-spin mb-4" />
                  <p className="text-gray-400">Connecting to Jumia API...</p>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl flex items-start gap-4">
                  <AlertCircle className="mt-1" />
                  <div>
                    <h3 className="font-bold text-lg">Connection Error</h3>
                    <p>{error}</p>
                    <button onClick={fetchShops} className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-all">Try Again</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {shops.map((shop, index) => (
                    <motion.div 
                      key={shop.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-panelBg border border-white/10 p-6 rounded-2xl backdrop-blur-lg hover:border-brand/50 transition-colors group cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-brand/20 transition-all">
                          <Package className="text-brand" />
                        </div>
                        <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-full border border-green-500/20">Active</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{shop.name || 'Unnamed Shop'}</h3>
                      <p className="text-sm text-gray-400 break-all">ID: {shop.id}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (
            <Products token={token} />
          )}

          {/* IMPORTER TAB */}
          {activeTab === 'importer' && (
            <Importer token={token} />
          )}

        </div>
      </main>
    </div>
  );
}