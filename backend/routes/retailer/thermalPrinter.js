// // routes/thermalPrinter.js
// const express = require('express');
// const router = express.Router();
// const net = require('net');

// // Network printing endpoint
// router.post('/print/thermal', async (req, res) => {
//     try {
//         const { printerIP, printerPort, escPosData, printerType } = req.body;
        
//         if (!printerIP || !escPosData) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Printer IP and ESC/POS data required'
//             });
//         }
        
//         // Decode base64 data
//         const buffer = Buffer.from(escPosData, 'base64');
        
//         // Send to printer via TCP socket
//         const client = new net.Socket();
        
//         client.connect(printerPort || 9100, printerIP, () => {
//             console.log(`Connected to printer at ${printerIP}:${printerPort || 9100}`);
//             client.write(buffer);
//             client.destroy();
            
//             res.json({
//                 success: true,
//                 message: 'Print job sent successfully'
//             });
//         });
        
//         client.on('error', (error) => {
//             console.error('Printer connection error:', error);
//             res.status(500).json({
//                 success: false,
//                 error: 'Failed to connect to printer: ' + error.message
//             });
//         });
        
//         client.setTimeout(5000, () => {
//             client.destroy();
//             res.status(500).json({
//                 success: false,
//                 error: 'Printer connection timeout'
//             });
//         });
        
//     } catch (error) {
//         console.error('Print error:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Print failed: ' + error.message
//         });
//     }
// });

// module.exports = router;


// routes/thermalPrinter.js
const express = require('express');
const router = express.Router();
const net = require('net');

router.post('/print/thermal', async (req, res) => {
    try {
        const { printerIP, printerPort, escPosData } = req.body;
        
        if (!printerIP || !escPosData) {
            return res.status(400).json({
                success: false,
                error: 'Printer IP and ESC/POS data required'
            });
        }
        
        // Decode base64 data
        const buffer = Buffer.from(escPosData, 'base64');
        
        // Send to printer via TCP socket
        const client = new net.Socket();
        
        client.connect(printerPort || 9100, printerIP, () => {
            console.log(`Connected to printer at ${printerIP}:${printerPort || 9100}`);
            client.write(buffer);
            client.destroy();
            
            res.json({
                success: true,
                message: 'Print job sent successfully'
            });
        });
        
        client.on('error', (error) => {
            console.error('Printer connection error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to connect to printer: ' + error.message
            });
        });
        
        client.setTimeout(5000, () => {
            client.destroy();
            res.status(500).json({
                success: false,
                error: 'Printer connection timeout'
            });
        });
        
    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({
            success: false,
            error: 'Print failed: ' + error.message
        });
    }
});

module.exports = router;