/**
 * Professional Email Template Wrapper for Deno Edge Functions
 * Provides consistent, beautiful styling for all platform emails
 * 
 * This is a Deno-compatible port of src/lib/email-template-wrapper.ts
 * Pure JavaScript with no React/Node dependencies
 */

export interface EmailTemplateOptions {
  title?: string;
  preheader?: string;
  headerGradient?: boolean;
  includeFooter?: boolean;
}

/**
 * Wraps email content in a professional, responsive email template
 * Matches the styling of auth emails with gradient header and proper email client support
 * 
 * @param content - The HTML content to wrap (can be a fragment or full HTML)
 * @param options - Template customization options
 * @returns Complete HTML email with professional styling
 */
export function wrapInProfessionalTemplate(
  content: string,
  options: EmailTemplateOptions = {}
): string {
  const {
    title = 'FineEarn',
    preheader = '',
    headerGradient = true,
    includeFooter = true,
  } = options;

  const gradientHeader = headerGradient
    ? `
          <!-- Gradient Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ${title}
              </h1>
            </td>
          </tr>`
    : '';

  const footer = includeFooter
    ? `
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #6c757d; line-height: 1.6;">
                <strong style="color: #495057;">FineEarn</strong> - Earn by Training AI
              </p>
              <p style="margin: 0 0 15px 0; font-size: 13px; color: #868e96; line-height: 1.5;">
                This email was sent from FineEarn. If you have any questions, please contact our support team.
              </p>
              <div style="margin-top: 15px;">
                <a href="https://fineearn.com" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 8px;">Website</a>
                <span style="color: #dee2e6;">|</span>
                <a href="https://fineearn.com/support" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 8px;">Support</a>
                <span style="color: #dee2e6;">|</span>
                <a href="https://fineearn.com/privacy" style="color: #667eea; text-decoration: none; font-size: 12px; margin: 0 8px;">Privacy Policy</a>
              </div>
              <p style="margin: 15px 0 0 0; font-size: 11px; color: #adb5bd;">
                © ${new Date().getFullYear()} FineEarn. All rights reserved.
              </p>
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .mobile-padding { padding: 15px !important; }
      h1 { font-size: 24px !important; }
      h2 { font-size: 20px !important; }
      .button { padding: 12px 25px !important; font-size: 14px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; line-height: 1.6;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
  
  <!-- Main Container -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f7;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        
        <!-- Email Content Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          
          ${gradientHeader}
          
          <!-- Content Area -->
          <tr>
            <td style="padding: 40px 30px;" class="mobile-padding">
              ${content}
            </td>
          </tr>
          
          ${footer}
          
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Creates a styled button for emails
 * 
 * @param text - Button text
 * @param url - Button link URL
 * @param color - Button color scheme (primary or secondary)
 * @returns HTML string for styled button
 */
export function createStyledButton(
  text: string,
  url: string,
  color: 'primary' | 'secondary' = 'primary'
): string {
  const bgColor = color === 'primary' ? '#667eea' : '#48bb78';
  
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
  <tr>
    <td align="center" style="border-radius: 6px; background-color: ${bgColor};">
      <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 35px; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

/**
 * Creates an info box for important information
 * 
 * @param content - The content to display in the info box
 * @param type - The type of info box (info, warning, or success)
 * @returns HTML string for info box
 */
export function createInfoBox(
  content: string,
  type: 'info' | 'warning' | 'success' = 'info'
): string {
  const colors = {
    info: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
    warning: { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
    success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' }
  };
  
  const { bg, border, text } = colors[type];
  
  return `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td style="background-color: ${bg}; border-left: 4px solid ${border}; padding: 15px 20px; border-radius: 4px;">
      <p style="margin: 0; color: ${text}; font-size: 14px; line-height: 1.6;">
        ${content}
      </p>
    </td>
  </tr>
</table>`;
}
