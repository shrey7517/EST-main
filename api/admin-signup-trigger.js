const crypto = require('crypto');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { uid, name, email } = req.body;

    if (!uid || !name || !email) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    // Generate secure HMAC token
    const secret = process.env.ADMIN_APPROVAL_SECRET || 'est_fallback_secure_approval_secret_key_2026';
    const token = crypto.createHmac('sha256', secret).update(uid).digest('hex');

    // Get Base URL
    const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
    const approveUrl = `${baseUrl}/api/approve-admin?uid=${uid}&token=${token}&action=approve`;
    const rejectUrl = `${baseUrl}/api/approve-admin?uid=${uid}&token=${token}&action=reject`;
    const dashboardUrl = `${baseUrl}/super-admin`;

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@example.com';
    const resendApiKey = process.env.RESEND_API_KEY;

    // Send email using Resend API (fetch-based to avoid NPM dependencies)
    const emailBody = {
      from: process.env.SENDER_EMAIL || 'EST Admin Portal <noreply@resend.dev>',
      to: [superAdminEmail],
      subject: `🚨 Admin Access Request: ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Request</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f1f5f9; padding: 24px; margin: 0; }
            .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
            .header { background: linear-gradient(135deg, #4f46e5, #6366f1); padding: 32px 24px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; }
            .content { padding: 32px 24px; }
            .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .detail-label { color: #94a3b8; font-size: 14px; font-weight: 500; }
            .detail-value { color: #f8fafc; font-size: 14px; font-weight: 600; font-family: monospace; }
            .actions { margin-top: 32px; display: flex; gap: 16px; justify-content: center; }
            .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; text-decoration: none; text-align: center; transition: all 0.2s; }
            .btn-approve { background-color: #10b981; background: #10b981; color: #ffffff !important; box-shadow: 0 4px 12px rgba(16,185,129,0.2); }
            .btn-reject { background-color: #ef4444; background: #ef4444; color: #ffffff !important; box-shadow: 0 4px 12px rgba(239,68,68,0.2); }
            .btn-dashboard { background: #334155; color: #cbd5e1 !important; margin-top: 16px; display: block; border: 1px solid rgba(255,255,255,0.05); }
            .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Admin Access Request</h1>
            </div>
            <div class="content">
              <p style="margin-top:0; font-size:16px; line-height:1.6; color:#cbd5e1;">A new user has registered and requested administrator access to the Entrepreneurship Skill Assessment Platform.</p>
              
              <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 16px; margin: 24px 0;">
                <div class="detail-row">
                  <span class="detail-label">Name</span>
                  <span class="detail-value" style="font-family: inherit;">${name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email</span>
                  <span class="detail-value">${email}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">User UID</span>
                  <span class="detail-value">${uid}</span>
                </div>
              </div>
              
              <div class="actions">
                <a href="${approveUrl}" class="btn btn-approve">Approve Access</a>
                <a href="${rejectUrl}" class="btn btn-reject">Reject Access</a>
              </div>
              
              <a href="${dashboardUrl}" class="btn btn-dashboard">Open Super-Admin Dashboard</a>
            </div>
            <div class="footer">
              This email was automatically generated by the EST Platform security system.
            </div>
          </div>
        </body>
        </html>
      `
    };

    if (resendApiKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailBody)
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.message || 'Failed to send email via Resend');
      }
    } else {
      console.log("Mock Email Sent (No RESEND_API_KEY):", emailBody);
    }

    res.status(200).json({ success: true, message: 'Approval notification sent to Super Admin' });
  } catch (error) {
    console.error('Email trigger error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
