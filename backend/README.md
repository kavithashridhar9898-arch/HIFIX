# HIFIX Backend — Run & Verify

This file explains how to run the backend bound to a specific IP and how to verify it's listening.

Default behavior
- The server will bind to the address defined by the `HOST` environment variable.
- If `HOST` is not set, the default is `192.168.138.251`.
- Port is set by `PORT` (defaults to `5000`).

Quick start (bash / WSL)
```bash
cd backend
npm install
# Start with default HOST=192.168.138.251 and PORT=5000
npm start

# Or explicitly set host/port in the same shell:
export HOST=192.168.138.251
export PORT=5000
npm start
```

Windows (PowerShell)
```powershell
cd backend
npm install
set HOST=192.168.138.251 && set PORT=5000 && npm start
```

Verify the HTTP health endpoint
```bash
curl http://192.168.138.251:5000/api/health
```

Check TCP binding
- WSL / Linux: `ss -tulpn | grep :5000` or `netstat -an | grep 5000`
- Windows PowerShell: `netstat -ano | findstr :5000`

Firewall
- Windows Firewall may block inbound connections. To allow port 5000 temporarily (Admin PowerShell):
```powershell
netsh advfirewall firewall add rule name="HIFIX API 5000" dir=in action=allow protocol=TCP localport=5000
```

Notes
- The server calls `initializeDatabase()` during startup. If your DB credentials are incorrect or the DB is unreachable the process may exit. Check `backend/.env` (or environment variables) and `backend/config/database.js`.
- If your machine does not have IP `192.168.138.251` assigned, binding to that IP will fail. Use `HOST=0.0.0.0` to bind all interfaces and then access the service on the machine's interface IP.

Troubleshooting
- If `npm start` fails with database errors, inspect the logs and share them and I can help fix the configuration.

If you want, I can start the server now and share the logs here. Reply `start` to proceed.
