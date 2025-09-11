// This is just the corrected renderFilePreview function
const renderFilePreview = () => {
    if (!msg.file) {
      return null;
    }
    
    const fileIcon = getFileIcon(msg.file.category || 'other', msg.file.type);
    const fileSize = formatFileSize(msg.file.size || 0);
    const fileUrl = constructFileUrl(msg.file);
    
    // Unified file display - no previews, just clean file card
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 max-w-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="text-2xl flex-shrink-0">{fileIcon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{msg.file.name}</p>
            <p className="text-xs text-gray-500">{fileSize}</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (fileUrl) {
              downloadFile(fileUrl, msg.file.name, msg.file.type);
            } else {
              // Fallback download method
              const token = localStorage.getItem('token');
              const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8181';
              const cleanFilename = msg.file.url?.split('/').pop()?.split('?')[0] || msg.file.name;
              const directUrl = `${baseUrl}/uploads/messages/${cleanFilename}`;
              const urlWithToken = token ? `${directUrl}?token=${encodeURIComponent(token)}` : directUrl;
              window.open(urlWithToken, '_blank');
            }
          }}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm flex-shrink-0 transition-colors duration-200 flex items-center space-x-1"
        >
          <Download size={14} />
          <span>Download</span>
        </button>
      </div>
    );
  };