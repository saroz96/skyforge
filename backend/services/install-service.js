// install-service.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { spawn } = require('child_process');

console.log('🔧 Installing XLab Print Service...\n');

// Create package.json for service
const packageJson = {
  name: "xlab-print-service",
  version: "1.0.0",
  description: "Local printing service for XLab thermal printers",
  main: "xlab-print-service.js",
  scripts: {
    "start": "node xlab-print-service.js",
    "install-service": "node install-service.js",
    "create-shortcut": "node create-shortcut.js"
  },
  dependencies: {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "usb": "^2.9.0"
  },
  keywords: ["thermal", "printer", "xlab", "escpos", "barcode"],
  author: "Your Company",
  license: "MIT"
};

// Save package.json
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ Created package.json');

// Create Windows service installer
const batContent = `@echo off
echo Installing XLab Print Service...
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js from:
    echo    https://nodejs.org/
    pause
    exit /b 1
)

:: Install dependencies
echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

:: Create startup script
echo 📝 Creating startup script...
(
echo @echo off
echo cd /d "%~dp0"
echo node xlab-print-service.js
echo pause
) > start-service.bat

:: Create desktop shortcut
echo 🔗 Creating desktop shortcut...
(
echo Set oWS = WScript.CreateObject^("WScript.Shell"^)
echo sLinkFile = "%USERPROFILE%\\Desktop\\XLab Printer.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "%~dp0start-service.bat"
echo oLink.WorkingDirectory = "%~dp0"
echo oLink.Description = "XLab Thermal Printer Service"
echo oLink.IconLocation = "%~dp0printer.ico"
echo oLink.Save
) > create-shortcut.vbs
cscript //nologo create-shortcut.vbs
del create-shortcut.vbs

:: Create Windows Service (optional)
echo ⚙️ Creating Windows Service...
echo.
echo To install as Windows Service:
echo 1. Install node-windows: npm install -g node-windows
echo 2. Run: node install-windows-service.js
echo.

:: Create uninstaller
echo 🗑️ Creating uninstaller...
(
echo @echo off
echo echo Uninstalling XLab Print Service...
echo.
echo :: Stop service if running
echo taskkill /f /im node.exe 2>nul
echo.
echo :: Remove files
echo del package-lock.json 2>nul
echo rmdir /s /q node_modules 2>nul
echo del start-service.bat 2>nul
echo del "%USERPROFILE%\\Desktop\\XLab Printer.lnk" 2>nul
echo.
echo echo ✅ Uninstallation complete!
echo pause
) > uninstall.bat

echo.
echo ✅ Installation complete!
echo.
echo 📋 Next steps:
echo 1. Connect your XLab printer via USB
echo 2. Double-click "XLab Printer" on your desktop
echo 3. Service will run on http://localhost:3005
echo.
echo 📞 For support, contact: support@yourcompany.com
echo.
pause
`;

fs.writeFileSync('install-windows.bat', batContent);

// Create installer for other platforms
const shContent = `#!/bin/bash
echo "🔧 Installing XLab Print Service..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js from:"
    echo "   https://nodejs.org/"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "📝 Creating startup script..."
cat > start-service.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
node xlab-print-service.js
EOF

chmod +x start-service.sh

echo "🔗 Creating desktop entry..."
cat > ~/.local/share/applications/xlab-printer.desktop << EOF
[Desktop Entry]
Name=XLab Printer
Comment=XLab Thermal Printer Service
Exec=$(pwd)/start-service.sh
Icon=$(pwd)/printer.png
Terminal=true
Type=Application
Categories=Utility;
EOF

echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Connect your XLab printer via USB"
echo "2. Run: ./start-service.sh"
echo "3. Service will run on http://localhost:3005"
echo ""
echo "📞 For support, contact: support@yourcompany.com"
`;

fs.writeFileSync('install-linux.sh', shContent);
fs.chmodSync('install-linux.sh', '755');

console.log(`
📁 Installation files created:

1. install-windows.bat   - Windows installer
2. install-linux.sh     - Linux/macOS installer
3. xlab-print-service.js - Main service

📋 To install on Windows:
   • Double-click "install-windows.bat"
   
📋 To install on Linux/macOS:
   • Run: sudo ./install-linux.sh

🎯 After installation, service will run on: http://localhost:3005
`);