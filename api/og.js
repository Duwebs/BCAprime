// ============================================================
// BCAPrime — api/og.js
// Dynamic Open Graph Image Generator for BCAPrime Resource Cards
// Renders a high-tech dark aesthetic preview card (1200x630)
// featuring B-Crown logo, resource title, subject, semester, and type.
// Compatible with @vercel/og Edge runtime with resilient fallback.
// Compatible with Node.js Serverless runtime and @vercel/og Edge runtime


// Fallback high-resolution SVG card generator (mirrors BCAPrime card layout)
function renderSvgCard({ title, subject, sem, type, college }) {
  const isPyq = type === 'pyq';
  const typeText = isPyq ? 'PYQ \u2022 EXAM PAPER' : 'NOTES \u2022 STUDY MATERIAL';
  const typeBg = isPyq ? 'rgba(139, 92, 246, 0.18)' : 'rgba(0, 112, 243, 0.18)';
  const typeBorder = isPyq ? 'rgba(139, 92, 246, 0.45)' : 'rgba(0, 112, 243, 0.45)';
  const typeColor = isPyq ? '#c4b5fd' : '#60a5fa';

  const semText = sem ? `Semester ${sem}` : 'All Semesters';
  const collegeText = college && college !== 'all' ? college.toUpperCase() : 'All Universities';

  // Sanitize for XML
  const cleanTitle = String(title || 'BCA Study Material')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const cleanSubject = String(subject || 'Computer Applications')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const cleanSem = String(semText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const cleanCollege = String(collegeText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Truncate title for 2-line rendering
  const title1 = cleanTitle.length > 40 ? cleanTitle.slice(0, 40) + '...' : cleanTitle;
  const title2 = cleanTitle.length > 40 && cleanTitle.length <= 80 ? cleanTitle.slice(40) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <!-- Background Ambient Glows -->
      <radialGradient id="glowBlue" cx="85%" cy="15%" r="60%">
        <stop offset="0%" stop-color="#0070f3" stop-opacity="0.28" />
        <stop offset="50%" stop-color="#0070f3" stop-opacity="0.08" />
        <stop offset="100%" stop-color="#05080b" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="glowPurple" cx="15%" cy="85%" r="55%">
        <stop offset="0%" stop-color="#7928ca" stop-opacity="0.22" />
        <stop offset="60%" stop-color="#7928ca" stop-opacity="0.04" />
        <stop offset="100%" stop-color="#05080b" stop-opacity="0" />
      </radialGradient>

      <!-- Card Gradient -->
      <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#101826" stop-opacity="0.96" />
        <stop offset="100%" stop-color="#090e15" stop-opacity="0.98" />
      </linearGradient>

      <!-- Logo Gradient -->
      <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0070f3" />
        <stop offset="100%" stop-color="#004fc4" />
      </linearGradient>

      <!-- Grid pattern -->
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>
      </pattern>
    </defs>

    <!-- Canvas Background -->
    <rect width="1200" height="630" fill="#05080b"/>
    <rect width="1200" height="630" fill="url(#grid)"/>
    <rect width="1200" height="630" fill="url(#glowBlue)"/>
    <rect width="1200" height="630" fill="url(#glowPurple)"/>

    <!-- Main Resource Card -->
    <rect x="70" y="60" width="1060" height="510" rx="28" ry="28" fill="url(#cardBg)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />

    <!-- Card Top Row -->
    <g transform="translate(118, 105)">
      <!-- Type Badge -->
      <rect x="0" y="0" width="${isPyq ? 180 : 220}" height="36" rx="8" fill="${typeBg}" stroke="${typeBorder}" stroke-width="1"/>
      <text x="${isPyq ? 90 : 110}" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="13" fill="${typeColor}" text-anchor="middle" letter-spacing="0.05em">${typeText}</text>

      <!-- PDF Format Badge -->
      <rect x="${isPyq ? 190 : 230}" y="0" width="60" height="36" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <text x="${isPyq ? 220 : 260}" y="23" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="13" fill="#94a3b8" text-anchor="middle">PDF</text>
    </g>

    <!-- Brand Header (Top Right) -->
    <g transform="translate(930, 95)">
      <!-- B-Crown Logo Icon -->
      <rect x="0" y="0" width="48" height="48" rx="13" fill="url(#logoGrad)" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <!-- Gold Crown -->
      <path d="M16 19 L13 11 L18 14 L24 9 L30 14 L35 11 L32 19 Z" fill="#f59e0b" stroke="#d97706" stroke-width="0.5"/>
      <!-- White B -->
      <text x="24" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Arial', sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle">B</text>

      <!-- Brand Text -->
      <text x="60" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="22" fill="#ffffff" letter-spacing="-0.02em">BCA<tspan fill="#3291ff">Prime</tspan></text>
      <text x="60" y="47" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="10.5" fill="#64748b" letter-spacing="0.08em">STUDY DESK</text>
    </g>

    <!-- Card Title -->
    <g transform="translate(118, 220)">
      <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="44" fill="#ffffff" letter-spacing="-0.025em">
        ${title1}
      </text>
      ${title2 ? `<text x="0" y="52" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="44" fill="#ffffff" letter-spacing="-0.025em">${title2}</text>` : ''}
    </g>

    <!-- Badges Row -->
    <g transform="translate(118, 325)">
      <!-- Subject Badge -->
      <rect x="0" y="0" width="360" height="44" rx="10" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <text x="18" y="28" font-size="18">&#128214;</text>
      <text x="48" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="16" fill="#f1f5f9">${cleanSubject.slice(0, 32)}</text>

      <!-- Semester Badge -->
      <rect x="375" y="0" width="165" height="44" rx="10" fill="rgba(0,112,243,0.15)" stroke="rgba(0,112,243,0.4)" stroke-width="1"/>
      <text x="390" y="28" font-size="16">&#128218;</text>
      <text x="418" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="16" fill="#38bdf8">${cleanSem}</text>

      <!-- College Badge -->
      <rect x="552" y="0" width="220" height="44" rx="10" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      <text x="568" y="27" font-size="16">&#127963;</text>
      <text x="596" y="27" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="15" fill="#94a3b8">${cleanCollege.slice(0, 18)}</text>
    </g>

    <!-- Card Footer Divider -->
    <line x1="118" y1="420" x2="1082" y2="420" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

    <!-- Card Footer -->
    <g transform="translate(118, 465)">
      <!-- Feature highlights -->
      <g transform="translate(0, 0)">
        <text x="0" y="0" font-size="16">&#128065;</text>
        <text x="26" y="-2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="14" fill="#94a3b8">Read Online</text>

        <text x="140" y="0" font-size="16">&#11015;</text>
        <text x="164" y="-2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="14" fill="#94a3b8">Download PDF</text>

        <text x="300" y="0" font-size="16">&#10024;</text>
        <text x="326" y="-2" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="14" fill="#94a3b8">100% Free</text>
      </g>

      <!-- CTA Pill Button -->
      <g transform="translate(740, -18)">
        <rect x="0" y="0" width="224" height="42" rx="21" fill="#0070f3"/>
        <text x="112" y="26" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="14.5" fill="#ffffff" text-anchor="middle">Open in BCAPrime &rarr;</text>
      </g>
    </g>

    <!-- Outer Bottom Tagline -->
    <text x="600" y="605" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="13.5" fill="#64748b" text-anchor="middle" letter-spacing="0.04em">
      bcaprime.vercel.app &bull; Free BCA study library &bull; Notes &bull; PYQs &bull; PrimeFinder
    </text>
  </svg>`;
}

async function handler(req, res) {
  try {
    const isNode = typeof res !== 'undefined' && typeof res.setHeader === 'function';
    let searchParams;
    if (req && req.query) {
      searchParams = new URLSearchParams(req.query);
    } else if (req && req.url) {
      searchParams = new URL(req.url, 'http://localhost').searchParams;
    } else {
      searchParams = new URLSearchParams();
    }

    const title = searchParams.get('title') || 'BCA Study Material';
    const subject = searchParams.get('subject') || 'Computer Applications';
    const sem = searchParams.get('sem') || '';
    const type = (searchParams.get('type') || 'notes').toLowerCase();
    const college = searchParams.get('college') || 'all';
    const format = searchParams.get('format');

    // 1. Check if @vercel/og ImageResponse is available
    if (format !== 'svg') {
      try {
        const { ImageResponse } = await import('@vercel/og');
        if (ImageResponse) {
          const isPyq = type === 'pyq';
          const typeBadgeText = isPyq ? 'PYQ \u2022 EXAM PAPER' : 'NOTES \u2022 STUDY MATERIAL';
          const typeColor = isPyq ? '#c4b5fd' : '#60a5fa';
          const typeBg = isPyq ? 'rgba(139, 92, 246, 0.18)' : 'rgba(0, 112, 243, 0.18)';
          const typeBorder = isPyq ? 'rgba(139, 92, 246, 0.45)' : 'rgba(0, 112, 243, 0.45)';
          const semText = sem ? `Semester ${sem}` : 'All Semesters';
          const collegeText = college && college !== 'all' ? college.toUpperCase() : 'All Colleges';

          return new ImageResponse(
            {
              type: 'div',
              props: {
                style: {
                  height: '100%',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#05080b',
                  backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(0, 112, 243, 0.28) 0%, transparent 65%), radial-gradient(circle at 15% 85%, rgba(121, 40, 202, 0.22) 0%, transparent 60%)',
                  padding: '50px 70px',
                  fontFamily: 'sans-serif',
                },
                children: [
                  // Main Card
                  {
                    type: 'div',
                    props: {
                      style: {
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        backgroundColor: '#0e1624',
                        border: '1.5px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '26px',
                        padding: '38px 46px',
                        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75)',
                      },
                      children: [
                        // Top Header Row
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%',
                            },
                            children: [
                              // Left badges
                              {
                                type: 'div',
                                props: {
                                  style: { display: 'flex', gap: '10px', alignItems: 'center' },
                                  children: [
                                    {
                                      type: 'div',
                                      props: {
                                        style: {
                                          padding: '7px 16px',
                                          borderRadius: '8px',
                                          backgroundColor: typeBg,
                                          border: `1px solid ${typeBorder}`,
                                          color: typeColor,
                                          fontSize: '13px',
                                          fontWeight: 800,
                                          letterSpacing: '0.04em',
                                        },
                                        children: typeBadgeText,
                                      },
                                    },
                                    {
                                      type: 'div',
                                      props: {
                                        style: {
                                          padding: '7px 14px',
                                          borderRadius: '8px',
                                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                          border: '1px solid rgba(255, 255, 255, 0.12)',
                                          color: '#94a3b8',
                                          fontSize: '13px',
                                          fontWeight: 700,
                                        },
                                        children: 'PDF',
                                      },
                                    },
                                  ],
                                },
                              },
                              // Right Brand (B-Crown Logo + BCA Prime)
                              {
                                type: 'div',
                                props: {
                                  style: { display: 'flex', alignItems: 'center', gap: '12px' },
                                  children: [
                                    {
                                      type: 'div',
                                      props: {
                                        style: {
                                          width: '46px',
                                          height: '46px',
                                          borderRadius: '13px',
                                          background: 'linear-gradient(135deg, #0070f3, #004fc4)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#ffffff',
                                          fontWeight: 900,
                                          fontSize: '22px',
                                          boxShadow: '0 4px 16px rgba(0, 112, 243, 0.4)',
                                          border: '1px solid rgba(255, 255, 255, 0.25)',
                                        },
                                        children: 'B',
                                      },
                                    },
                                    {
                                      type: 'div',
                                      props: {
                                        style: { display: 'flex', flexDirection: 'column' },
                                        children: [
                                          {
                                            type: 'div',
                                            props: {
                                              style: { fontSize: '22px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' },
                                              children: [
                                                'BCA',
                                                { type: 'span', props: { style: { color: '#3291ff' }, children: 'Prime' } },
                                              ],
                                            },
                                          },
                                          {
                                            type: 'div',
                                            props: {
                                              style: { fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em' },
                                              children: 'STUDY DESK',
                                            },
                                          },
                                        ],
                                      },
                                    },
                                  ],
                                },
                              },
                            ],
                          },
                        },

                        // Middle Title
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              margin: '18px 0',
                            },
                            children: [
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    fontSize: title.length > 50 ? '38px' : '46px',
                                    fontWeight: 800,
                                    lineHeight: 1.25,
                                    color: '#ffffff',
                                    letterSpacing: '-0.025em',
                                  },
                                  children: title,
                                },
                              },
                            ],
                          },
                        },

                        // Metadata Badges Row
                        {
                          type: 'div',
                          props: {
                            style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
                            children: [
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    padding: '8px 18px',
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: '#f1f5f9',
                                    fontSize: '17px',
                                    fontWeight: 600,
                                  },
                                  children: `\u{1F4D6} ${subject}`,
                                },
                              },
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    padding: '8px 18px',
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(0, 112, 243, 0.16)',
                                    border: '1px solid rgba(0, 112, 243, 0.4)',
                                    color: '#38bdf8',
                                    fontSize: '17px',
                                    fontWeight: 700,
                                  },
                                  children: `\u{1F4DA} ${semText}`,
                                },
                              },
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    color: '#94a3b8',
                                    fontSize: '16px',
                                  },
                                  children: `\u{1F3DB}\uFE0F ${collegeText}`,
                                },
                              },
                            ],
                          },
                        },

                        // Card Bottom Row
                        {
                          type: 'div',
                          props: {
                            style: {
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                              paddingTop: '20px',
                              width: '100%',
                            },
                            children: [
                              {
                                type: 'div',
                                props: {
                                  style: { display: 'flex', gap: '22px', color: '#94a3b8', fontSize: '15px', fontWeight: 600 },
                                  children: [
                                    { type: 'span', props: { children: '\u{1F441}\uFE0F Read Online' } },
                                    { type: 'span', props: { children: '\u2B07\uFE0F Instant Download' } },
                                    { type: 'span', props: { children: '\u2728 100% Free' } },
                                  ],
                                },
                              },
                              {
                                type: 'div',
                                props: {
                                  style: {
                                    backgroundColor: '#0070f3',
                                    color: '#ffffff',
                                    padding: '11px 26px',
                                    borderRadius: '999px',
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    boxShadow: '0 4px 14px rgba(0, 112, 243, 0.45)',
                                  },
                                  children: 'Open in BCAPrime \u2192',
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            {
              width: 1200,
              height: 630,
            }
          );
          if (isNode) {
            const buf = Buffer.from(await img.arrayBuffer());
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
            return res.status(200).end(buf);
          }
          return img;
        }
      } catch (ogError) {
        console.warn('[BCAPrime] @vercel/og render skipped, using SVG fallback:', ogError.message);
      }
    }

    // 2. High-resolution SVG fallback (always works, 0 dependencies)
    const svg = renderSvgCard({ title, subject, sem, type, college });

    if (isNode) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      return res.status(200).send(svg);
    }

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[BCAPrime] OG Image error:', err);
    const svg = renderSvgCard({ title: 'BCA Study Material', subject: 'BCAPrime', sem: '', type: 'notes', college: 'all' });
    if (typeof res !== 'undefined' && typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(svg);
    }
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}

module.exports = handler;
module.exports.default = handler;
