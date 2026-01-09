// xlab-print-service.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const usb = require('usb');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class XLabPrintService {
    constructor() {
        this.app = express();
        this.port = 3005; // Default port for printing service
        this.printer = null;
        this.printerType = null; // 'usb', 'network', 'file'
        
        this.setupMiddleware();
        this.setupRoutes();
        this.autoDetectPrinter();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(bodyParser.json({ limit: '10mb' }));
        this.app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' }));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'running', 
                service: 'xlab-print-service',
                version: '1.0.0',
                printer: this.printerType,
                connected: !!this.printer
            });
        });

        // List available USB printers
        this.app.get('/printers/usb', (req, res) => {
            const devices = usb.getDeviceList();
            const printers = devices.filter(device => {
                // Common thermal printer vendor IDs
                const vendorIds = [
                    0x0416, // BIXOLON
                    0x067B, // Prolific
                    0x0483, // STMicroelectronics
                    0x0525, // Netcom
                    0x6868  // Generic thermal printer
                ];
                return vendorIds.includes(device.deviceDescriptor.idVendor);
            }).map(device => ({
                vendorId: device.deviceDescriptor.idVendor,
                productId: device.deviceDescriptor.idProduct,
                vendorIdHex: '0x' + device.deviceDescriptor.idVendor.toString(16).padStart(4, '0'),
                productIdHex: '0x' + device.deviceDescriptor.idProduct.toString(16).padStart(4, '0')
            }));
            
            res.json({ printers });
        });

        // Print ESC/POS commands
        this.app.post('/print/escpos', async (req, res) => {
            try {
                const { data, printerType = 'usb', options = {} } = req.body;
                
                if (!data) {
                    return res.status(400).json({ error: 'No print data provided' });
                }

                // Convert base64 to buffer if needed
                let printData;
                if (typeof data === 'string') {
                    printData = Buffer.from(data, 'base64');
                } else {
                    printData = Buffer.from(data);
                }

                // Print based on type
                let result;
                switch (printerType) {
                    case 'usb':
                        result = await this.printViaUSB(printData, options);
                        break;
                    case 'network':
                        result = await this.printViaNetwork(printData, options);
                        break;
                    case 'file':
                        result = await this.saveToFile(printData, options);
                        break;
                    default:
                        throw new Error(`Unknown printer type: ${printerType}`);
                }

                res.json({ success: true, message: 'Print job sent', ...result });
            } catch (error) {
                console.error('Print error:', error);
                res.status(500).json({ 
                    error: error.message,
                    code: error.code 
                });
            }
        });

        // Raw print (binary data)
        this.app.post('/print/raw', (req, res) => {
            try {
                const printData = req.body;
                
                if (!printData || printData.length === 0) {
                    return res.status(400).json({ error: 'No print data provided' });
                }

                // Try to print via USB
                this.printViaUSB(printData)
                    .then(() => {
                        res.json({ success: true, message: 'Raw print job sent' });
                    })
                    .catch(error => {
                        // Fallback to file
                        const filename = path.join(__dirname, 'prints', `print_${Date.now()}.bin`);
                        fs.writeFileSync(filename, printData);
                        res.json({ 
                            success: true, 
                            message: 'Saved to file (USB failed)', 
                            file: filename 
                        });
                    });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Print label (structured data)
        this.app.post('/print/label', (req, res) => {
            try {
                const { 
                    barcode, 
                    itemName, 
                    batchNumber, 
                    expiryDate, 
                    mrp, 
                    companyName,
                    quantity = 1 
                } = req.body;

                // Generate ESC/POS commands
                const escPosData = this.generateLabelESC({
                    barcode,
                    itemName,
                    batchNumber,
                    expiryDate,
                    mrp,
                    companyName
                });

                // Print multiple copies
                const printJobs = [];
                for (let i = 0; i < quantity; i++) {
                    printJobs.push(this.printViaUSB(escPosData));
                }

                Promise.all(printJobs)
                    .then(() => {
                        res.json({ 
                            success: true, 
                            message: `Printed ${quantity} label(s)` 
                        });
                    })
                    .catch(error => {
                        res.status(500).json({ error: error.message });
                    });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Test printer
        this.app.get('/print/test', async (req, res) => {
            try {
                const testData = this.generateTestPage();
                await this.printViaUSB(testData);
                res.json({ success: true, message: 'Test print sent' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    // Generate ESC/POS commands for label
    generateLabelESC(labelData) {
        const cmds = [];
        
        // Initialize
        cmds.push(0x1B, 0x40); // ESC @
        
        // Center alignment
        cmds.push(0x1B, 0x61, 0x01); // ESC a 1
        
        // Company name (bold, double height)
        cmds.push(0x1B, 0x21, 0x30); // Double height/width
        cmds.push(0x1B, 0x45, 0x01); // Bold on
        cmds.push(...Buffer.from(labelData.companyName + '\n', 'ascii'));
        cmds.push(0x1B, 0x45, 0x00); // Bold off
        cmds.push(0x1B, 0x21, 0x00); // Normal
        
        // Line feed
        cmds.push(0x0A);
        
        // Barcode (CODE128)
        cmds.push(0x1D, 0x68, 100); // Height
        cmds.push(0x1D, 0x77, 2);   // Width
        cmds.push(0x1D, 0x6B, 0x49); // CODE128
        cmds.push(labelData.barcode.length + 2);
        cmds.push(0x7B, 0x42); // Start B
        cmds.push(...Buffer.from(labelData.barcode, 'ascii'));
        cmds.push(0x7D); // Stop
        cmds.push(0x00); // Terminate
        
        // Line feeds
        cmds.push(0x0A, 0x0A);
        
        // Details
        cmds.push(0x1B, 0x61, 0x00); // Left align
        cmds.push(...Buffer.from(`Item: ${labelData.itemName.substring(0, 24)}\n`, 'ascii'));
        cmds.push(...Buffer.from(`Batch: ${labelData.batchNumber}  Exp: ${labelData.expiryDate}\n`, 'ascii'));
        cmds.push(...Buffer.from(`MRP: ₹${parseFloat(labelData.mrp).toFixed(2)}\n`, 'ascii'));
        
        // Footer
        cmds.push(0x0A);
        cmds.push(...Buffer.from(new Date().toLocaleString('en-IN') + '\n', 'ascii'));
        cmds.push(0x0A, 0x0A, 0x0A);
        
        // Cut paper
        cmds.push(0x1D, 0x56, 0x41, 0x00); // Full cut
        
        return Buffer.from(cmds);
    }

    // Generate test page
    generateTestPage() {
        const cmds = [];
        
        // Initialize
        cmds.push(0x1B, 0x40);
        
        // Center and print test
        cmds.push(0x1B, 0x61, 0x01);
        cmds.push(0x1B, 0x45, 0x01);
        cmds.push(...Buffer.from('XLab Printer Test\n', 'ascii'));
        cmds.push(0x1B, 0x45, 0x00);
        
        // Details
        cmds.push(...Buffer.from('========================\n', 'ascii'));
        cmds.push(...Buffer.from(`Service: XLab Print Service\n`, 'ascii'));
        cmds.push(...Buffer.from(`Date: ${new Date().toLocaleDateString()}\n`, 'ascii'));
        cmds.push(...Buffer.from(`Time: ${new Date().toLocaleTimeString()}\n`, 'ascii'));
        cmds.push(...Buffer.from('========================\n', 'ascii'));
        
        // Barcode test
        cmds.push(0x0A);
        cmds.push(0x1D, 0x68, 80);
        cmds.push(0x1D, 0x77, 2);
        cmds.push(0x1D, 0x6B, 0x49);
        cmds.push(12);
        cmds.push(0x7B, 0x42);
        cmds.push(...Buffer.from('TEST123456', 'ascii'));
        cmds.push(0x7D, 0x00);
        
        // Feed and cut
        cmds.push(0x0A, 0x0A, 0x0A, 0x0A);
        cmds.push(0x1D, 0x56, 0x41, 0x00);
        
        return Buffer.from(cmds);
    }

    // Print via USB (using node-usb)
    async printViaUSB(data, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // Find XLab printer
                const devices = usb.getDeviceList();
                const printer = devices.find(device => {
                    // Common XLab vendor IDs
                    const vendorIds = [
                        0x0416, // BIXOLON (common for XLab)
                        0x0483, // STMicroelectronics
                        0x6868  // Generic thermal
                    ];
                    return vendorIds.includes(device.deviceDescriptor.idVendor);
                });

                if (!printer) {
                    throw new Error('XLab printer not found. Check USB connection.');
                }

                // Open device
                printer.open();
                
                // Try to claim interface
                const iface = printer.interfaces[0];
                if (iface.isKernelDriverActive()) {
                    iface.detachKernelDriver();
                }
                
                iface.claim();
                
                // Send data to endpoint
                const endpoint = iface.endpoints.find(ep => 
                    ep.direction === 'out' && ep.transferType === 2
                );
                
                if (!endpoint) {
                    throw new Error('No output endpoint found');
                }
                
                endpoint.transfer(data, error => {
                    if (error) {
                        reject(error);
                    } else {
                        // Clean up
                        setTimeout(() => {
                            iface.release(true, () => {
                                printer.close();
                                resolve({ method: 'usb', bytes: data.length });
                            });
                        }, 100);
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // Print via Network (TCP/IP)
    async printViaNetwork(data, options = {}) {
        return new Promise((resolve, reject) => {
            const { host = '192.168.1.100', port = 9100 } = options;
            
            const client = new net.Socket();
            
            client.connect(port, host, () => {
                client.write(data);
                client.end();
                resolve({ method: 'network', host, port, bytes: data.length });
            });
            
            client.on('error', (error) => {
                reject(error);
            });
            
            client.setTimeout(5000, () => {
                client.destroy();
                reject(new Error('Network timeout'));
            });
        });
    }

    // Save to file (fallback)
    async saveToFile(data, options = {}) {
        const filename = options.filename || `print_${Date.now()}.bin`;
        const filepath = path.join(__dirname, 'prints', filename);
        
        // Ensure directory exists
        if (!fs.existsSync(path.join(__dirname, 'prints'))) {
            fs.mkdirSync(path.join(__dirname, 'prints'), { recursive: true });
        }
        
        fs.writeFileSync(filepath, data);
        
        return { 
            method: 'file', 
            filepath, 
            bytes: data.length,
            message: 'ESC/POS file saved. Use XLab software to print.'
        };
    }

    // Auto-detect printer
    autoDetectPrinter() {
        try {
            const devices = usb.getDeviceList();
            const printer = devices.find(device => 
                [0x0416, 0x0483, 0x6868].includes(device.deviceDescriptor.idVendor)
            );
            
            if (printer) {
                this.printer = printer;
                this.printerType = 'usb';
                console.log(`Auto-detected printer: Vendor 0x${printer.deviceDescriptor.idVendor.toString(16)}`);
            }
        } catch (error) {
            console.log('Auto-detect failed:', error.message);
        }
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`
╔══════════════════════════════════════════════════════════╗
║          XLab Print Service v1.0                         ║
║                                                          ║
║  ✅ Service running on port ${this.port}                     ║
║  📍 Endpoints:                                          ║
║     • http://localhost:${this.port}/health              ║
║     • http://localhost:${this.port}/printers/usb        ║
║     • http://localhost:${this.port}/print/escpos        ║
║     • http://localhost:${this.port}/print/test          ║
║                                                          ║
║  🔌 Printer Status: ${this.printer ? 'Connected' : 'Disconnected'}                    ║
║  🖨️  Type: ${this.printerType || 'None'}                            ║
╚══════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start service if run directly
if (require.main === module) {
    const service = new XLabPrintService();
    service.start();
}

module.exports = XLabPrintService;