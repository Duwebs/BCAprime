/**
 * BCAPrime Shared Colleges (Vanilla JS runtime bundle for browser)
 * lib/colleges.js
 *
 * Exposes window.BCA_COLLEGES_MODULE
 */
(function(window) {
  'use strict';

  var BCA_BASE_COLLEGES = [
    ['all', 'All Colleges'],
    ['amity', 'Amity University'],
    ['adbu', 'Assam Don Bosco University'],
    ['avviare', 'Avviare Educational Hub'],
    ['banasthali', 'Banasthali Vidyapith'],
    ['bvp', 'Bharati Vidyapeeth'],
    ['bitmesra', 'BIT Mesra'],
    ['cu', 'Chandigarh University'],
    ['chitkara', 'Chitkara University'],
    ['christ', 'Christ University'],
    ['davv', 'DAVV (Devi Ahilya Vishwavidyalaya)'],
    ['gauhati', 'Gauhati University'],
    ['glocal', 'Glocal University'],
    ['goa', 'Goa University'],
    ['geu', 'Graphic Era University'],
    ['hpu', 'Himachal Pradesh University'],
    ['kiit', 'KIIT University'],
    ['kuk', 'Kurukshetra University'],
    ['manipur', 'Manipur University'],
    ['mizoram', 'Mizoram University'],
    ['nagaland', 'Nagaland University'],
    ['nirma', 'Nirma University'],
    ['pu', 'Panjab University'],
    ['patna', 'Patna University'],
    ['pondi', 'Pondicherry University'],
    ['rgu', 'Rajiv Gandhi University'],
    ['smu', 'Sikkim Manipal University'],
    ['srm', 'SRM Institute of Science and Technology'],
    ['tripura', 'Tripura University'],
    ['uok', 'University of Kashmir'],
    ['kerala', 'University of Kerala'],
    ['ccsu', 'CCSU Meerut'],
    ['du', 'Delhi University'],
    ['ipu', 'GGSIPU Delhi'],
    ['aktu', 'AKTU / UPTU'],
    ['ignou', 'IGNOU'],
    ['mdu', 'MDU Rohtak'],
    ['bhu', 'BHU'],
    ['pune', 'Pune University'],
    ['bangalore', 'Bangalore University'],
    ['other', 'Other University']
  ];

  var CUSTOM_MONOGRAMS = {
    'amity': 'AU',
    'adbu': 'AD',
    'avviare': 'AE',
    'banasthali': 'BV',
    'bvp': 'BV',
    'bitmesra': 'BM',
    'cu': 'CU',
    'chitkara': 'CU',
    'christ': 'CU',
    'davv': 'DA',
    'gauhati': 'GU',
    'glocal': 'GU',
    'goa': 'GU',
    'geu': 'GE',
    'hpu': 'HP',
    'kiit': 'KU',
    'kuk': 'KU',
    'manipur': 'MU',
    'mizoram': 'MU',
    'nagaland': 'NU',
    'nirma': 'NU',
    'pu': 'PU',
    'patna': 'PU',
    'pondi': 'PU',
    'rgu': 'RG',
    'smu': 'SM',
    'srm': 'SR',
    'tripura': 'TU',
    'uok': 'UK',
    'kerala': 'UK',
    'ccsu': 'CC',
    'du': 'DU',
    'ipu': 'GG'
  };

  var BADGE_COLORS = {
    'amity': '#2563eb',
    'adbu': '#059669',
    'avviare': '#2563eb',
    'banasthali': '#db2777',
    'bvp': '#7c3aed',
    'bitmesra': '#d97706',
    'cu': '#dc2626',
    'chitkara': '#ea580c',
    'christ': '#4f46e5',
    'davv': '#0891b2',
    'gauhati': '#16a34a',
    'glocal': '#16a34a',
    'goa': '#0284c7',
    'geu': '#9333ea',
    'hpu': '#e11d48',
    'kiit': '#0d9488',
    'kuk': '#6366f1',
    'manipur': '#059669',
    'mizoram': '#ca8a04',
    'nagaland': '#2563eb',
    'nirma': '#dc2626',
    'pu': '#4338ca',
    'patna': '#0891b2',
    'pondi': '#0d9488',
    'rgu': '#7c3aed',
    'smu': '#0284c7',
    'srm': '#ea580c',
    'tripura': '#16a34a',
    'uok': '#4f46e5',
    'kerala': '#059669',
    'ccsu': '#3b82f6',
    'du': '#1e40af',
    'ipu': '#dc2626'
  };

  var COLLEGE_NAMES_MAP = {};
  BCA_BASE_COLLEGES.forEach(function(item) {
    COLLEGE_NAMES_MAP[item[0]] = item[1];
  });

  function getCollegeBadgeData(id, name) {
    var monogram = CUSTOM_MONOGRAMS[id];
    if (!monogram && name) {
      var clean = name.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(function(w) {
        return ['of', 'and', 'the', 'in', 'for', '&'].indexOf(w.toLowerCase()) === -1;
      });
      if (clean.length >= 2) {
        monogram = (clean[0][0] + clean[1][0]).toUpperCase();
      } else if (clean.length === 1 && clean[0].length >= 2) {
        monogram = clean[0].slice(0, 2).toUpperCase();
      } else {
        monogram = (name.slice(0, 2) || 'BC').toUpperCase();
      }
    }
    if (!monogram) monogram = 'BC';

    var color = BADGE_COLORS[id];
    if (!color) {
      var colors = ['#2563eb', '#16a34a', '#7c3aed', '#dc2626', '#d97706', '#0284c7', '#4f46e5', '#0d9488', '#e11d48'];
      var hash = 0;
      var str = name || id || 'bca';
      for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      color = colors[Math.abs(hash) % colors.length];
    }
    return { monogram: monogram, color: color };
  }

  function slugifyCollege(name) {
    return String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'custom-college';
  }

  function formatCollegeName(codeOrId, customList) {
    if (!codeOrId) return 'All Colleges';
    var c = String(codeOrId).toLowerCase().trim();
    if (c === 'all') return 'All Colleges';
    if (c === 'other') return 'Other University';
    if (COLLEGE_NAMES_MAP[c]) return COLLEGE_NAMES_MAP[c];
    var cleanCode = c.replace(/^custom-/, '');
    if (COLLEGE_NAMES_MAP[cleanCode]) return COLLEGE_NAMES_MAP[cleanCode];
    if (Array.isArray(customList)) {
      for (var i = 0; i < customList.length; i++) {
        var rowId = String(customList[i][0] || '').toLowerCase().trim();
        if (rowId === c || rowId === cleanCode) return customList[i][1];
      }
    }
    // Filter out raw timestamp or numeric IDs (e.g. 1793989321691)
    if (/^\d{8,}$/.test(cleanCode) || /^custom-\d+$/.test(c) || /^\d+$/.test(cleanCode)) {
      return 'Other Affiliated College';
    }
    var formatted = cleanCode.replace(/-/g, ' ').replace(/\b\w/g, function(l) { return l.toUpperCase(); });
    if (/^\d+$/.test(formatted.trim())) return 'Other Affiliated College';
    return formatted || 'Other University';
  }

  function mergeColleges(baseList, approvedCustom) {
    baseList = baseList || BCA_BASE_COLLEGES;
    approvedCustom = approvedCustom || [];
    var merged = baseList.slice();
    var seenNames = {};
    var seenIds = {};

    baseList.forEach(function(b) {
      seenNames[b[1].toLowerCase().trim()] = true;
      seenIds[b[0].toLowerCase().trim()] = true;
    });

    approvedCustom.forEach(function(item) {
      var name = String(item.name || '').trim();
      if (!name) return;
      var nameLower = name.toLowerCase();
      if (seenNames[nameLower]) return;

      var id = item.id ? String(item.id).toLowerCase().trim() : 'custom-' + slugifyCollege(name);
      if (seenIds[id]) {
        id = id + '-' + Math.random().toString(36).slice(2, 6);
      }

      seenNames[nameLower] = true;
      seenIds[id] = true;

      var otherIdx = -1;
      for (var j = 0; j < merged.length; j++) {
        if (merged[j][0] === 'other') { otherIdx = j; break; }
      }
      if (otherIdx !== -1) {
        merged.splice(otherIdx, 0, [id, name]);
      } else {
        merged.push([id, name]);
      }
    });

    return merged;
  }

  window.BCA_COLLEGES_MODULE = {
    BCA_BASE_COLLEGES: BCA_BASE_COLLEGES,
    BCA_COLLEGES: BCA_BASE_COLLEGES.slice(),
    COLLEGE_NAMES_MAP: COLLEGE_NAMES_MAP,
    CUSTOM_MONOGRAMS: CUSTOM_MONOGRAMS,
    BADGE_COLORS: BADGE_COLORS,
    getCollegeBadgeData: getCollegeBadgeData,
    slugifyCollege: slugifyCollege,
    formatCollegeName: formatCollegeName,
    mergeColleges: mergeColleges
  };
})(typeof window !== 'undefined' ? window : this);
