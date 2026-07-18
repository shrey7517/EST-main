const admin = require('firebase-admin');
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

  const { uid, token, action } = req.query;

  if (!uid || !token || !action) {
    res.status(400).send('<h1>Invalid Link</h1><p>Missing required parameters.</p>');
    return;
  }

  // Validate Token
  const secret = process.env.ADMIN_APPROVAL_SECRET || 'est_fallback_secure_approval_secret_key_2026';
  const expectedToken = crypto.createHmac('sha256', secret).update(uid).digest('hex');

  if (token !== expectedToken) {
    res.status(403).send('<h1>Forbidden</h1><p>Invalid approval token.</p>');
    return;
  }

  try {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing from the environment configuration.');
      }
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);

    if (action === 'approve') {
      await userRef.update({ role: 'admin' });
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Approval Success</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background-color: #1e293b; padding: 40px; border-radius: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
            h1 { color: #10b981; font-weight: 800; margin-bottom: 16px; }
            p { color: #cbd5e1; margin-bottom: 24px; }
            .btn { background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Access Approved!</h1>
            <p>The user has been successfully promoted to the Admin role.</p>
            <a href="/super-admin" class="btn">Back to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    } else if (action === 'reject') {
      await userRef.update({ role: 'rejected' });
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Rejection Success</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background-color: #1e293b; padding: 40px; border-radius: 16px; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
            h1 { color: #ef4444; font-weight: 800; margin-bottom: 16px; }
            p { color: #cbd5e1; margin-bottom: 24px; }
            .btn { background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Request Rejected</h1>
            <p>The admin request has been successfully rejected.</p>
            <a href="/super-admin" class="btn">Back to Dashboard</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.status(400).send('<h1>Bad Request</h1><p>Invalid action.</p>');
    }
  } catch (error) {
    console.error('Approval API error:', error);
    res.status(500).send(`<h1>Error</h1><p>Failed to update user role: ${error.message}</p>`);
  }
};
