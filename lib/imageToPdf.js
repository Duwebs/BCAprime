// lib/imageToPdf.js — Client-side image-to-PDF conversion
// Merges one or more image files into a single A4 PDF using jsPDF.
// Exposes window.convertImagesToPdf(imageFiles, onProgress) -> Promise<{blob, filename}>

(function () {
  'use strict';

  const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic)$/i;
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const PAGE_MARGIN_MM = 0;

  function isImageFile(file) {
    if (!file || !file.type) return false;
    if (file.type.startsWith('image/')) return true;
    return IMAGE_EXTENSIONS.test(file.name || '');
  }

  function classifyFiles(files) {
    const images = [];
    const others = [];
    for (let i = 0; i < files.length; i++) {
      if (isImageFile(files[i])) {
        images.push(files[i]);
      } else {
        others.push(files[i]);
      }
    }
    return { images, others };
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('Failed to load image: ' + file.name)); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('FileReader error for: ' + file.name)); };
      reader.readAsDataURL(file);
    });
  }

  function heicToJpegBlob(file) {
    // HEIC files may not be supported by canvas in all browsers.
    // We attempt to draw them via Image; if it fails we return null.
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(function (blob) {
            resolve(blob || null);
          }, 'image/jpeg', 0.92);
        };
        img.onerror = function () { resolve(null); };
        img.src = reader.result;
      };
      reader.onerror = function () { resolve(null); };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert an array of image Files into a single PDF blob.
   * @param {File[]} imageFiles
   * @param {function} [onProgress] - callback(progressPercent: number, message: string)
   * @returns {Promise<{blob: Blob, filename: string}>}
   */
  async function convertImagesToPdf(imageFiles, onProgress) {
    if (!imageFiles || imageFiles.length === 0) {
      throw new Error('No image files provided');
    }

    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      throw new Error('jsPDF library not loaded');
    }

    var total = imageFiles.length;
    var doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (var i = 0; i < total; i++) {
      var pct = Math.round(((i) / total) * 100);
      if (onProgress) onProgress(pct, 'Processing photo ' + (i + 1) + ' of ' + total + '…');

      if (i > 0) doc.addPage();

      var file = imageFiles[i];
      var img;

      // Attempt to load HEIC (may fail in unsupported browsers — try canvas conversion)
      if (/\.(heic)$/i.test(file.name)) {
        var jpegBlob = await heicToJpegBlob(file);
        if (jpegBlob) {
          img = await loadImage(new File([jpegBlob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }));
        } else {
          // Skip this image if HEIC can't be decoded
          if (onProgress) onProgress(pct, 'Skipping ' + file.name + ' (HEIC not supported on this device)');
          continue;
        }
      } else {
        img = await loadImage(file);
      }

      var imgWidth = img.naturalWidth || img.width;
      var imgHeight = img.naturalHeight || img.height;
      var ratio = imgWidth / imgHeight;

      var pdfContentWidth = A4_WIDTH_MM - (PAGE_MARGIN_MM * 2);
      var pdfContentHeight = A4_HEIGHT_MM - (PAGE_MARGIN_MM * 2);

      var drawWidth, drawHeight;
      if (ratio > (pdfContentWidth / pdfContentHeight)) {
        // Image is wider relative to A4 — fit by width
        drawWidth = pdfContentWidth;
        drawHeight = pdfContentWidth / ratio;
      } else {
        // Image is taller — fit by height
        drawHeight = pdfContentHeight;
        drawWidth = pdfContentHeight * ratio;
      }

      // Center the image on the page
      var xOffset = (A4_WIDTH_MM - drawWidth) / 2;
      var yOffset = (A4_HEIGHT_MM - drawHeight) / 2;

      // Determine image data format for jsPDF
      var src = img.src || '';
      var fmt = 'JPEG';
      if (/\.png/i.test(file.name) || src.indexOf('image/png') !== -1) {
        fmt = 'PNG';
      } else if (/\.webp/i.test(file.name) || src.indexOf('image/webp') !== -1) {
        // jsPDF doesn't natively support WEBP — convert via canvas
        fmt = 'JPEG';
        var c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        var cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);
        src = c.toDataURL('image/jpeg', 0.92);
      }

      doc.addImage(src, fmt, xOffset, yOffset, drawWidth, drawHeight);
    }

    if (onProgress) onProgress(95, 'Finalizing PDF…');

    var ts = Date.now();
    var filename = 'Converted_Notes_' + ts + '.pdf';
    var blob = doc.output('blob');

    if (onProgress) onProgress(100, 'PDF ready');

    return { blob: blob, filename: filename };
  }

  // Expose globally
  window.convertImagesToPdf = convertImagesToPdf;
  window.classifyUploadFiles = classifyFiles;
  window.isImageFile = isImageFile;
})();
