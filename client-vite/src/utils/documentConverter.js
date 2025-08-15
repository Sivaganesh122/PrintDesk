// Document conversion utilities
export const convertDocxToPreview = async (file) => {
  try {
    // For now, we'll create a realistic DOCX preview
    // In a real implementation, you would use a library like mammoth.js or docx.js
    
    const fileSize = file.size;
    const estimatedPages = Math.max(1, Math.floor(fileSize / 5000)); // Rough estimate
    
    const pages = Array.from({ length: estimatedPages }, (_, i) => ({
      id: i,
      thumbnail: `https://via.placeholder.com/150x200/28a745/ffffff?text=DOCX+Page+${i + 1}`,
      pageNumber: i + 1,
      selected: false,
      type: 'docx',
      fileName: file.name
    }));
    
    return {
      success: true,
      pages,
      fileType: 'docx',
      totalPages: estimatedPages
    };
  } catch (error) {
    console.error('DOCX conversion error:', error);
    return {
      success: false,
      error: 'Failed to convert DOCX file'
    };
  }
};

export const convertDocToPreview = async (file) => {
  try {
    // For DOC files, create a preview
    const fileSize = file.size;
    const estimatedPages = Math.max(1, Math.floor(fileSize / 4000)); // Rough estimate
    
    const pages = Array.from({ length: estimatedPages }, (_, i) => ({
      id: i,
      thumbnail: `https://via.placeholder.com/150x200/6c757d/ffffff?text=DOC+Page+${i + 1}`,
      pageNumber: i + 1,
      selected: false,
      type: 'doc',
      fileName: file.name
    }));
    
    return {
      success: true,
      pages,
      fileType: 'doc',
      totalPages: estimatedPages
    };
  } catch (error) {
    console.error('DOC conversion error:', error);
    return {
      success: false,
      error: 'Failed to convert DOC file'
    };
  }
};

export const getFileTypeInfo = (fileName) => {
  const extension = fileName.split('.').pop().toLowerCase();
  
  const fileTypes = {
    pdf: { type: 'pdf', icon: 'pdf', color: 'danger' },
    docx: { type: 'docx', icon: 'docx', color: 'success' },
    doc: { type: 'doc', icon: 'doc', color: 'secondary' },
    jpg: { type: 'image', icon: 'image', color: 'primary' },
    jpeg: { type: 'image', icon: 'image', color: 'primary' },
    png: { type: 'image', icon: 'image', color: 'primary' },
    gif: { type: 'image', icon: 'image', color: 'primary' },
    bmp: { type: 'image', icon: 'image', color: 'primary' }
  };
  
  return fileTypes[extension] || { type: 'unknown', icon: 'file', color: 'muted' };
}; 