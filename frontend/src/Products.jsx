import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Products({ token }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Pagination & Search State
  const [currentPage, setCurrentPage] = useState(1);
  const [nextTokens, setNextTokens] = useState({});
  const [searchType, setSearchType] = useState('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  // Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' });

  const fetchProducts = async (tokenParam = null) => {
    setLoading(true);
    setError('');
    try {
      let url = `https://jumia-vendor-mcp.onrender.com/api/products?type=${searchType}`;
      if (tokenParam) url += `&token=${encodeURIComponent(tokenParam)}`;
      if (activeSearch) url += `&search=${encodeURIComponent(activeSearch)}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch products. Check connection.');
      const data = await response.json();
      
      let fetchedProducts = data.products || [];

      if (activeSearch && searchType === 'name') {
        fetchedProducts = fetchedProducts.filter(p => 
          (p.name || '').toLowerCase().includes(activeSearch.toLowerCase())
        );
      }

      setProducts(fetchedProducts);
      
      if (data.nextToken) {
        setNextTokens(prev => ({ ...prev, [currentPage]: data.nextToken }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setNextTokens({});
    setActiveSearch(searchQuery);
    fetchProducts();
  };

  const nextPage = () => {
    const nextToken = nextTokens[currentPage];
    if (nextToken) {
      setCurrentPage(prev => prev + 1);
      fetchProducts(nextToken);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      const prevToken = currentPage === 2 ? null : nextTokens[currentPage - 2];
      setCurrentPage(prev => prev - 1);
      fetchProducts(prevToken);
    }
  };

  // --- MODAL LOGIC ---
  const openModal = (product) => {
    setSelectedProduct(product);
    const variation = product.variations?.[0] || {};
    const bc = variation.businessClients?.[0] || {};
    
    setEditPrice(variation.globalPrice?.value || '');
    setEditStatus(bc.status || 'ACTIVE');
    setSaveMessage({ type: '', text: '' });
  };

  const closeModal = () => {
    setSelectedProduct(null);
  };

  const handleSave = async () => {
    if (!selectedProduct) return;
    setSaving(true);
    setSaveMessage({ type: '', text: 'Saving to Jumia...' });

    const variation = selectedProduct.variations?.[0];
    const bc = variation.businessClients?.[0];

    try {
      // 1. Update Price if changed
      if (editPrice && variation.globalPrice && Number(editPrice) !== variation.globalPrice.value) {
        const priceRes = await fetch('https://jumia-vendor-mcp.onrender.com/api/products/update-price', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerSku: variation.sellerSku,
            id: variation.id,
            category: selectedProduct.category?.code,
            newPrice: editPrice,
            currency: variation.globalPrice.currency
          })
        });
        if (!priceRes.ok) throw new Error('Failed to update price');
      }

      // 2. Update Status if changed
      if (editStatus && bc.status !== editStatus) {
        const statusRes = await fetch('https://jumia-vendor-mcp.onrender.com/api/products/update-status', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sellerSku: variation.sellerSku,
            id: variation.id,
            businessClientCode: bc.code,
            newStatus: editStatus
          })
        });
        if (!statusRes.ok) throw new Error('Failed to update status');
      }

      setSaveMessage({ type: 'success', text: 'Changes saved successfully!' });
      setTimeout(() => {
        closeModal();
        fetchProducts(); // Refresh the table
      }, 1500);

    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Product Catalog</h2>
        
        <form onSubmit={handleSearch} className="flex items-center gap-2 w-full md:w-auto">
          <select 
            value={searchType} 
            onChange={(e) => setSearchType(e.target.value)}
            className="bg-panelBg border border-white/10 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-brand"
          >
            <option value="name">By Name</option>
            <option value="sku">By SKU</option>
          </select>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-panelBg border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-brand"
            />
          </div>
          <button type="submit" className="bg-brand hover:bg-yellow-500 text-darkBg font-bold px-4 py-2 rounded-xl transition-colors">
            Search
          </button>
        </form>
      </div>

      {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20">{error}</div>}

      {/* Products Table */}
      <div className="bg-panelBg border border-white/10 rounded-2xl overflow-hidden backdrop-blur-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-white/5 text-gray-400 border-b border-white/10">
              <tr>
                <th className="px-6 py-4">Image</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Seller SKU</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-brand">
                    <Loader2 size={30} className="animate-spin mx-auto mb-2" />
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product, index) => {
                  const variation = product.variations?.[0] || {};
                  const bc = variation.businessClients?.[0] || {};
                  const price = variation.globalPrice ? `${variation.globalPrice.value} ${variation.globalPrice.currency}` : 'N/A';
                  const status = bc.status || 'UNKNOWN';
                  
                  let imgUrl = null;
                  if (product.images && product.images.length > 0) {
                    imgUrl = product.images[0].url || product.images[0].originalUrl;
                  }

                  return (
                    <motion.tr 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.05 }}
                      key={product.id || index} 
                      onClick={() => openModal(product)}
                      className="border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        {imgUrl ? (
                          <img src={imgUrl} alt="Product" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                            <ImageIcon size={20} className="text-gray-500" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-white">{product.name || 'Unnamed Product'}</td>
                      <td className="px-6 py-4 font-mono text-xs">{variation.sellerSku || 'N/A'}</td>
                      <td className="px-6 py-4">{price}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
          <button onClick={prevPage} disabled={currentPage === 1 || loading} className="flex items-center px-4 py-2 bg-panelBg border border-white/10 rounded-lg disabled:opacity-50 hover:bg-white/10 transition-colors text-sm">
            <ChevronLeft size={16} className="mr-1" /> Previous
          </button>
          <span className="text-sm text-gray-400">Page {currentPage}</span>
          <button onClick={nextPage} disabled={!nextTokens[currentPage] || loading} className="flex items-center px-4 py-2 bg-panelBg border border-white/10 rounded-lg disabled:opacity-50 hover:bg-white/10 transition-colors text-sm">
            Next <ChevronRight size={16} className="ml-1" />
          </button>
        </div>
      </div>

      {/* --- PRODUCT DETAIL MODAL --- */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-darkBg border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                <h3 className="text-xl font-bold text-white line-clamp-1">{selectedProduct.name}</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors bg-white/5 p-2 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left: Images */}
                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase mb-4">Product Images</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedProduct.images?.map((img, i) => (
                      <img key={i} src={img.url} alt="Product" className="w-full h-auto rounded-xl border border-white/10 object-cover" />
                    ))}
                    {(!selectedProduct.images || selectedProduct.images.length === 0) && (
                      <div className="col-span-2 py-10 text-center bg-white/5 rounded-xl text-gray-500">No images available</div>
                    )}
                  </div>
                </div>

                {/* Right: Edit Form */}
                <div className="space-y-6">
                  {saveMessage.text && (
                    <div className={`p-3 rounded-lg text-sm font-bold ${saveMessage.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {saveMessage.text}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">Status</label>
                    <select 
                      value={editStatus} 
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-panelBg border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand"
                    >
                      <option value="ACTIVE">ACTIVE (Live on Jumia)</option>
                      <option value="INACTIVE">INACTIVE (Hidden)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">Price</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-gray-400">
                        {selectedProduct.variations?.[0]?.globalPrice?.currency || 'KES'}
                      </span>
                      <input 
                        type="number" 
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full bg-panelBg border border-white/10 text-white rounded-xl pl-14 pr-4 py-3 focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Product SID</p>
                    <p className="text-sm font-mono text-white mb-3">{selectedProduct.id}</p>
                    <p className="text-xs text-gray-400 mb-1">Seller SKU</p>
                    <p className="text-sm font-mono text-white">{selectedProduct.variations?.[0]?.sellerSku}</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                <button onClick={closeModal} className="px-6 py-2 rounded-xl text-gray-300 hover:bg-white/10 transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="flex items-center px-6 py-2 bg-brand hover:bg-yellow-500 text-darkBg font-bold rounded-xl transition-all shadow-glow disabled:opacity-50"
                >
                  {saving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}