import { useState } from 'react';
import { UploadCloud, FileArchive, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Importer({ token }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

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
      // Pointing to your live Render server
      const response = await fetch('https://jumia-vendor-mcp.onrender.com/api/import/zip', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to process ZIP file.');
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
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
          
          <input 
            type="file" 
            accept=".zip" 
            id="zipUpload" 
            className="hidden" 
            onChange={handleFileChange} 
          />
          
          <div className="flex gap-4 items-center">
            <label 
              htmlFor="zipUpload" 
              className="cursor-pointer px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl transition-colors font-semibold"
            >
              {file ? file.name : "Browse Files"}
            </label>

            {file && (
              <button 
                onClick={handleUpload} 
                disabled={uploading}
                className="flex items-center px-6 py-3 bg-brand hover:bg-yellow-500 text-darkBg font-bold rounded-xl transition-all shadow-glow disabled:opacity-50"
              >
                {uploading ? <Loader2 size={20} className="animate-spin mr-2" /> : <FileArchive size={20} className="mr-2" />}
                {uploading ? 'Processing...' : 'Start Import'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl flex items-center gap-4">
            <CheckCircle className="text-green-400" size={32} />
            <div>
              <h3 className="text-lg font-bold text-white">Import Successful!</h3>
              <p className="text-green-400">Found {results.extractedProducts.length} potential products and {results.totalImagesFound} images.</p>
            </div>
          </div>

          <div className="bg-panelBg border border-white/10 rounded-2xl overflow-hidden backdrop-blur-lg">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/5 text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Extracted Image</th>
                  <th className="px-6 py-4">Raw Text from WhatsApp</th>
                  <th className="px-6 py-4">Suggested Price</th>
                </tr>
              </thead>
              <tbody>
                {results.extractedProducts.map((prod, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-6 py-4">
                      {prod.image ? (
                        <img src={prod.image} className="w-16 h-16 rounded-lg object-cover" alt="extracted" />
                      ) : (
                        <div className="w-16 h-16 bg-white/5 rounded-lg flex items-center justify-center text-xs text-gray-500">No Img</div>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-md">{prod.rawText}</td>
                    <td className="px-6 py-4 font-mono text-brand">{prod.price ? `${prod.price} KES` : 'Not found'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}