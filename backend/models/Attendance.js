const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    // Reference to duty schedule
    dutySchedule: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DutySchedule'
    },
    // Store duty hours for that day (in case schedule changes later)
    scheduledDutyHours: {
        startTime: String, // HH:MM format
        endTime: String,   // HH:MM format
        gracePeriod: Number, // in minutes
        officeLocationId: mongoose.Schema.Types.ObjectId
    },
    clockIn: {
        time: {
            type: Date,
            required: true
        },
        location: {
            lat: Number,
            lng: Number,
            accuracy: Number,
            address: String
        },
        officeLocationId: mongoose.Schema.Types.ObjectId
    },
    clockOut: {
        time: Date,
        location: {
            lat: Number,
            lng: Number,
            accuracy: Number,
            address: String
        },
        officeLocationId: mongoose.Schema.Types.ObjectId
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'half-day', 'leave', 'holiday', 'off-duty'],
        default: 'absent'
    },
    totalHours: {
        type: Number,
        default: 0
    },
    overtime: {
        type: Number,
        default: 0
    },
    lateMinutes: {
        type: Number,
        default: 0
    },
    earlyDepartureMinutes: {
        type: Number,
        default: 0
    },
    source: {
        type: String,
        enum: ['geo-fence', 'manual', 'qr-code', 'admin'],
        default: 'geo-fence'
    },
    deviceInfo: {
        browser: String,
        os: String,
        ip: String
    },
    notes: String,
    adjustedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adjustedAt: Date
}, {
    timestamps: true
});

// Create compound index for efficient queries
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ company: 1, date: 1 });
attendanceSchema.index({ dutySchedule: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);