import { Theme } from './themes.js';

// Data-URI placeholder image to satisfy CSP (img-src 'self' data:)
export const DATA_HERO = "data:image/svg+xml;utf8," + encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='800' height='300'>
    <defs>
      <linearGradient id='g' x1='0' x2='1'>
        <stop offset='0%' stop-color='#086bd4'/>
        <stop offset='100%' stop-color='#4f46e5'/>
      </linearGradient>
    </defs>
    <rect width='800' height='300' fill='url(#g)'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
      font-family='Aptos, Arial, sans-serif' font-size='36' fill='#fff'>
      Hero Placeholder
    </text>
  </svg>
`);

export const SampleTemplates = {
  productNewsletter: {
    name: 'Product Newsletter',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-text font-size="14px" color="#222222" font-family="${Theme.fontFamily}" />
      <mj-button background-color="${Theme.brandColor}" color="#ffffff" border-radius="4px" />
      <mj-image padding="0" />
    </mj-attributes>
    <mj-style>
      .legal a { color: ${Theme.brandColor}; text-decoration: underline; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f4f5f7">
    <mj-section background-color="#ffffff" padding="24px 16px">
      <mj-column>
        <mj-image src="${Theme.logoUrl}" alt="Logo" width="140px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 16px 24px">
      <mj-column>
        <mj-image src="${DATA_HERO}" alt="Hero" />
        <mj-text font-size="22px" font-weight="700" padding-top="16px">What’s New in Our Product</mj-text>
        <mj-text>Discover new features that boost your workflow.</mj-text>
        <mj-button href="https://example.com">Read the full update</mj-button>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 16px 24px">
      <mj-column>
        <mj-text font-size="18px" font-weight="600">Feature A</mj-text>
        <mj-text>Short description of feature A with benefits.</mj-text>
      </mj-column>
      <mj-column>
        <mj-text font-size="18px" font-weight="600">Feature B</mj-text>
        <mj-text>Short description of feature B with benefits.</mj-text>
      </mj-column>
    </mj-section>

    <mj-section padding="16px" background-color="#ffffff">
      <mj-column>
        <mj-button href="https://example.com/cta">Try It Now</mj-button>
      </mj-column>
    </mj-section>

    <mj-section padding="16px">
      <mj-column>
        <mj-text font-size="12px" color="#6b7280" css-class="legal">
          You received this because you signed up. <a href="#">Unsubscribe</a> • 123 Example St, City
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`.trim()
  },

  eventAnnouncement: {
    name: 'Event Announcement',
    mjml: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-text font-size="14px" color="#222222" font-family="${Theme.fontFamily}" />
      <mj-button background-color="${Theme.brandColor}" color="#ffffff" border-radius="4px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f4f5f7">
    <mj-section background-color="#ffffff" padding="24px 16px">
      <mj-column>
        <mj-image src="${Theme.logoUrl}" alt="Logo" width="140px" />
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 16px 24px">
      <mj-column>
        <mj-text font-size="24px" font-weight="700">Join Us: Future of Work Webinar</mj-text>
        <mj-text>Date: Nov 12, 2025 • 10:00–11:00</mj-text>
        <mj-button href="https://example.com/register">Register now</mj-button>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="0 16px 24px">
      <mj-column width="66%">
        <mj-text font-size="18px" font-weight="600">What you'll learn</mj-text>
        <mj-text>AI workflows, consultant mindset, and EQ readiness.</mj-text>
      </mj-column>
      <mj-column width="34%">
        <mj-image src="${DATA_HERO}" alt="Speakers" />
      </mj-column>
    </mj-section>

    <mj-section padding="16px">
      <mj-column>
        <mj-text font-size="12px" color="#6b7280">
          © 2025 Company. <a href="#" style="color:${Theme.brandColor};">Privacy</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`.trim()
  }
};

export default SampleTemplates;
