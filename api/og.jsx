// ============================================================
// BCAPrime — api/og.jsx
// Dynamic Open Graph Image Generator for BCAPrime Resource Cards
// Runs on Vercel Edge Runtime using @vercel/og (Satori + Resvg)
// Produces a crystal clear 1200x630 PNG preview card with B-Crown logo,
// semester, subject, resource type (Notes/PYQ), and clean dark aesthetic.
// ============================================================

import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    const title = searchParams.get('title') || 'BCA Study Material';
    const subject = searchParams.get('subject') || 'Computer Applications';
    const sem = searchParams.get('sem') || '';
    const type = (searchParams.get('type') || 'notes').toLowerCase();
    const college = searchParams.get('college') || 'all';

    const isPyq = type === 'pyq';
    const typeBadgeText = isPyq ? 'PYQ \u2022 EXAM PAPER' : 'NOTES \u2022 STUDY MATERIAL';
    const typeColor = isPyq ? '#c4b5fd' : '#60a5fa';
    const typeBg = isPyq ? 'rgba(139, 92, 246, 0.18)' : 'rgba(0, 112, 243, 0.18)';
    const typeBorder = isPyq ? 'rgba(139, 92, 246, 0.45)' : 'rgba(0, 112, 243, 0.45)';
    const semText = sem ? `Semester ${sem}` : 'All Semesters';
    const collegeText = college && college !== 'all' ? college.toUpperCase() : 'All Universities';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#05080b',
            backgroundImage:
              'radial-gradient(circle at 85% 15%, rgba(0, 112, 243, 0.28) 0%, transparent 65%), radial-gradient(circle at 15% 85%, rgba(121, 40, 202, 0.22) 0%, transparent 60%)',
            padding: '45px 65px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Main Resource Card */}
          <div
            style={{
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
            }}
          >
            {/* Top row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    backgroundColor: typeBg,
                    border: `1px solid ${typeBorder}`,
                    color: typeColor,
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                  }}
                >
                  {typeBadgeText}
                </div>
                <div
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  PDF
                </div>
              </div>

              {/* Brand: Crown Logo + BCA Prime */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="10" fill="#0070f3" />
                  <path
                    d="M12 11 H23 C26.866 11 30 14.134 30 18 C30 20.25 28.93 22.25 27.28 23.5 C29.5 24.8 31 27.2 31 30 C31 34.418 27.418 38 23 38 H12 V11 Z"
                    fill="#ffffff"
                  />
                  <circle cx="16" cy="18" r="2.5" fill="#0070f3" />
                  <circle cx="23" cy="18" r="2.5" fill="#0070f3" />
                  <circle cx="20" cy="28" r="3" fill="#0070f3" />
                </svg>
                <span
                  style={{
                    fontSize: '21px',
                    fontWeight: 900,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  BCA<span style={{ color: '#0070f3' }}>Prime</span>
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#38bdf8',
                    backgroundColor: 'rgba(0, 112, 243, 0.18)',
                    border: '1px solid rgba(0, 112, 243, 0.4)',
                    borderRadius: '6px',
                    padding: '2px 7px',
                  }}
                >
                  v2.0
                </span>
              </div>
            </div>

            {/* Middle Section: Subject & Title */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                margin: 'auto 0',
                width: '100%',
              }}
            >
              <div
                style={{
                  color: '#38bdf8',
                  fontSize: '16px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {subject}
              </div>
              <div
                style={{
                  color: '#f8fafc',
                  fontSize: '42px',
                  fontWeight: 900,
                  lineHeight: 1.2,
                  letterSpacing: '-0.02em',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {title}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(0, 112, 243, 0.12)',
                    border: '1px solid rgba(0, 112, 243, 0.3)',
                    color: '#38bdf8',
                    fontSize: '16px',
                    fontWeight: 700,
                  }}
                >
                  {'\u{1F4DA}'} {semText}
                </div>
                <div
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#94a3b8',
                    fontSize: '15px',
                  }}
                >
                  {'\u{1F3DB}\uFE0F'} {collegeText}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: '20px',
                width: '100%',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '22px',
                  color: '#94a3b8',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                <span>{'\u{1F441}\uFE0F'} Read Online</span>
                <span>{'\u2B07\uFE0F'} Instant Download</span>
                <span>{'\u2728'} 100% Free</span>
              </div>
              <div
                style={{
                  backgroundColor: '#0070f3',
                  color: '#ffffff',
                  padding: '10px 24px',
                  borderRadius: '999px',
                  fontSize: '15px',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(0, 112, 243, 0.45)',
                }}
              >
                Open in BCAPrime &rarr;
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        },
      }
    );
  } catch (err) {
    console.error('[BCAPrime] OG Image error:', err);
    return new Response('Failed to generate image', { status: 500 });
  }
}
