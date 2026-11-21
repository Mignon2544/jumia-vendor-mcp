import { useState, useEffect } from 'react';
import { UploadCloud, FileArchive, CheckCircle, Loader2, Download, Sparkles, Send } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Importer({ token }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  
  // Shop Selection State
  const [shops, setShops] = useState([]);
  const [selectedShop, setSelectedShop] = useState('');

  // Fetch shops on load so you can select where to publish
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const res = await fetch('https://jumia-vendor-mcp.onrender.com/api/shops', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setShops(data);
          if (data.length > 0) {
            setSelectedShop(data[0].id || data[0].shopId);
          }
        }
      } catch (err) {
        console.error("Failed to load shops", err);
      }
    };
    fetchShops();
  }, [token]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('zipFile', file);

    try {
      const response = await fetch('https://jumia-vendor-mcp.onrender.com/api/import/zip', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process ZIP file.');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAICategorize = async () => {
    setCategorizing(true);
    setError('');
    try {
      const response = await fetch('https://jumia-vendor-mcp.onrender.com/api/import/ai-categorize', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ products: results.extractedProducts })
      });
      
      if (!response.ok) throw new Error('AI categorization failed. Check server logs.');
      
      const data = await response.json();
      // Update results with enriched products (prices and categories)
      setResults({ ...results, extractedProducts: data.enrichedProducts });
    } catch (err) {
      setError(err.message);
    } finally {
      setCategorizing(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const response = await fetch('https://jumia-vendor-mcp.onrender.com/api/export/excel', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ products: results.extractedProducts })
      });
      
      if (!response.ok) throw new Error("Failed to generate Excel");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Jumia_Import.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError("Failed to download Excel file.");
    }
  };

  const publishToJumia = async () => {
    if (!selectedShop) return alert("Please select a shop first.");
    setPublishing(true);
    setError('');
    
    try {
      const response = await fetch('https://jumia-vendor-mcp.onrender.com/api/import/publish', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          products: results.extractedProducts,
          shopId: selectedShop
        })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to publish to Jumia.');
      }
      
      alert("Products pushed to Jumia successfully! Check your Jumia dashboard in a few minutes.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-white">WhatsApp Importer</h2>
        <p className="text-gray-400 mt-1">Upload a ZIP file exported from WhatsApp to extract products.</p>
      </header>

      {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20">{error}</div>}

      {!results ? (
        <div className="bg-panelBg border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center backdrop-blur-lg">
          <motion.div 
            animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
            className="w-24 h-24 bg-brand/10 rounded-full flex items-center justify-center mb-6 shadow-glow"
          >
            <UploadCloud size={48} className="text-brand" />
          </motion.div>
          
          <h3 className="text-xl font-bold text-white mb-2">Upload ZIP File</h3>
          <p className="text-gray-400 mb-8 max-w-md">Select the ZIP file containing your WhatsApp chat export (_chat.txt) and product images.</p>
          
          <input type="file" accept=".zip" id="zipUpload" className="hidden" onChange={handleFileChange} />
          
          <div className="flex gap-4 items-center">
            <label htmlFor="zipUpload" className="cursor-pointer px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl transition-colors font-semibold">
              {file ? file.name : "Browse Files"}
            </label>

            {file && (
              <button onClick={handleUpload} disabled={uploading} className="flex items-center px-6 py-3 bg-brand hover:bg-yellow-500 text-darkBg font-bold rounded-xl transition-all shadow-glow disabled:opacity-50">
                {uploading ? <Loader2 size={20} className="animate-spin mr-2" /> : <FileArchive size={20} className="mr-2" />}
                {uploading ? 'Processing...' : 'Start Import'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          
          <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex items-center gap-4">
              <CheckCircle className="text-green-400" size={32} />
              <div>
                <h3 className="text-lg font-bold text-white">Import Successful!</h3>
                <p className="text-green-400">Found {results.extractedProducts.length} products.</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Shop Selector */}
              <select 
                value={selectedShop} 
                onChange={(e) => setSelectedShop(e.target.value)}
                className="bg-panelBg border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-brand"
              >
                {shops.map(s => (
                  <option key={s.id || s.shopId} value={s.id || s.shopId}>{s.name || s.shopName}</option>
                ))}
              </select>

              <button onClick={handleAICategorize} disabled={categorizing} className="flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50">
                {categorizing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />} 
                {categorizing ? 'AI Thinking...' : 'AI Categorize'}
              </button>

              <button onClick={downloadExcel} className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg">
                <Download size={20} /> Export
              </button>

              <button onClick={publishToJumia} disabled={publishing} className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50">
                {publishing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} 
                {publishing ? 'Publishing...' : 'Push to Jumia'}
              </button>
            </div>
          </div>

          <div className="bg-panelBg border border-white/10 rounded-2xl overflow-hidden backdrop-blur-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-white/5 text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">Image</th>
                    <th className="px-6 py-4">Raw Text</th>
                    <th className="px-6 py-4">Wholesale Cost</th>
                    <th className="px-6 py-4">Jumia Selling Price</th>
                    <th className="px-6 py-4">AI Category</th>
                  </tr>
                </thead>
                <tbody>
                  {results.extractedProducts.map((prod, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        {prod.image ? (
                          <img src={prod.image} className="w-16 h-16 rounded-lg object-cover border border-white/10" alt="extracted" />
                        ) : (
                          <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center text-xs text-gray-500 border border-white/10">No Img</div>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-md">{prod.rawText}</td>
                      <td className="px-6 py-4 font-mono text-gray-400">
                        {prod.costPrice ? `KES ${prod.costPrice}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-mono text-green-400 font-bold text-lg">
                        {prod.sellingPrice ? `KES ${prod.sellingPrice}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {prod.categoryName ? (
                          <div>
                            <p className="font-bold text-purple-400">{prod.categoryName}</p>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">Not categorized</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}