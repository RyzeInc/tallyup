import Link from "next/link";

export default function OfflinePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Offline - TallyUp</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            padding: 20px;
          }
          
          .container {
            text-align: center;
            max-width: 480px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 24px;
            padding: 48px 32px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          
          .icon {
            font-size: 64px;
            margin-bottom: 24px;
            opacity: 0.9;
          }
          
          h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 16px;
            letter-spacing: -0.5px;
          }
          
          p {
            font-size: 16px;
            line-height: 1.6;
            opacity: 0.9;
            margin-bottom: 32px;
          }
          
          .button {
            display: inline-block;
            background: white;
            color: #667eea;
            padding: 14px 32px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
          }
          
          .button:active {
            transform: translateY(0);
          }
          
          .status {
            margin-top: 24px;
            font-size: 14px;
            opacity: 0.7;
          }
          
          @media (prefers-color-scheme: dark) {
            body {
              background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            }
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="icon">📡</div>
          <h1>You're Offline</h1>
          <p>
            TallyUp needs an internet connection to sync your financial data.
            Your truth is waiting for you when you reconnect.
          </p>
          <button
            className="button"
            onClick={() => window.location.reload()}
            type="button"
          >
            Try Again
          </button>
          <div className="status">
            <span id="status">Checking connection...</span>
          </div>
        </div>
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Monitor connection status
              function updateStatus() {
                const statusEl = document.getElementById('status');
                if (navigator.onLine) {
                  statusEl.textContent = 'Connection restored! Tap "Try Again"';
                  statusEl.style.color = '#4ade80';
                } else {
                  statusEl.textContent = 'Still offline...';
                  statusEl.style.color = 'rgba(255, 255, 255, 0.7)';
                }
              }
              
              window.addEventListener('online', updateStatus);
              window.addEventListener('offline', updateStatus);
              updateStatus();
              
              // Auto-retry when connection is restored
              window.addEventListener('online', () => {
                setTimeout(() => {
                  window.location.reload();
                }, 1000);
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
