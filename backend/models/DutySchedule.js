// const mongoose = require('mongoose');

// const dutyScheduleSchema = new mongoose.Schema({
//     user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true
//     },
//     company: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'Company',
//         required: true
//     },
//     // Schedule can be for specific dates or recurring
//     scheduleType: {
//         type: String,
//         enum: ['specific', 'recurring'],
//         required: true,
//         default: 'recurring'
//     },
//     // For specific dates
//     specificDates: [{
//         type: Date,
//         required: function() { return this.scheduleType === 'specific'; }
//     }],
//     // For recurring schedule
//     recurringPattern: {
//         type: String,
//         enum: ['daily', 'weekly', 'monthly'],
//         required: function() { return this.scheduleType === 'recurring'; }
//     },
//     // Days of week for weekly pattern (0 = Sunday, 1 = Monday, etc.)
//     weekDays: [{
//         type: Number,
//         min: 0,
//         max: 6
//     }],
//     // For monthly pattern
//     monthDays: [{
//         type: Number,
//         min: 1,
//         max: 31
//     }],
//     // Start and end date for recurring schedule
//     startDate: {
//         type: Date,
//         required: function() { return this.scheduleType === 'recurring'; }
//     },
//     endDate: Date,
//     // Duty hours
//     dutyHours: {
//         startTime: {
//             type: String,
//             required: true,
//             match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format
//         },
//         endTime: {
//             type: String,
//             required: true,
//             match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
//         },
//         gracePeriod: {
//             type: Number, // in minutes
//             default: 15,
//             min: 0,
//             max: 60
//         },
//         breakDuration: {
//             type: Number, // in minutes
//             default: 60,
//             min: 0
//         }
//     },
//     // Office location for this duty
//     officeLocationId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'OfficeLocation'
//     },
//     // Is this schedule active
//     isActive: {
//         type: Boolean,
//         default: true
//     },
//     // Created by admin/supervisor
//     createdBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true
//     },
//     notes: String
// }, {
//     timestamps: true
// });

// // Index for efficient queries
// dutyScheduleSchema.index({ user: 1, company: 1, isActive: 1 });
// dutyScheduleSchema.index({ company: 1, startDate: 1, endDate: 1 });

// // Method to check if schedule applies to a specific date
// dutyScheduleSchema.methods.appliesToDate = function(date) {
//     const checkDate = new Date(date);
//     checkDate.setHours(0, 0, 0, 0);

//     if (this.scheduleType === 'specific') {
//         return this.specificDates.some(specificDate => {
//             const d = new Date(specificDate);
//             d.setHours(0, 0, 0, 0);
//             return d.getTime() === checkDate.getTime();
//         });
//     } else if (this.scheduleType === 'recurring') {
//         // Check if date is within range
//         if (checkDate < new Date(this.startDate)) return false;
//         if (this.endDate && checkDate > new Date(this.endDate)) return false;

//         if (this.recurringPattern === 'daily') {
//             return true;
//         } else if (this.recurringPattern === 'weekly') {
//             const dayOfWeek = checkDate.getDay();
//             return this.weekDays.includes(dayOfWeek);
//         } else if (this.recurringPattern === 'monthly') {
//             const dayOfMonth = checkDate.getDate();
//             return this.monthDays.includes(dayOfMonth);
//         }
//     }
//     return false;
// };

// module.exports = mongoose.model('DutySchedule', dutyScheduleSchema);

const mongoose = require('mongoose');

const dutyScheduleSchema = new mongoose.Schema({
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
    // Schedule can be for specific dates or recurring
    scheduleType: {
        type: String,
        enum: ['specific', 'recurring'],
        required: true,
        default: 'recurring'
    },
    // For specific dates
    specificDates: [{
        type: Date,
        required: function () { return this.scheduleType === 'specific'; }
    }],
    // For recurring schedule
    recurringPattern: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: function () { return this.scheduleType === 'recurring'; }
    },
    // Days of week for weekly pattern (0 = Sunday, 1 = Monday, etc.)
    weekDays: [{
        type: Number,
        min: 0,
        max: 6
    }],
    // For monthly pattern
    monthDays: [{
        type: Number,
        min: 1,
        max: 31
    }],
    // Start and end date for recurring schedule
    startDate: {
        type: Date,
        required: function () { return this.scheduleType === 'recurring'; }
    },
    endDate: Date,
    // Duty hours
    dutyHours: {
        startTime: {
            type: String,
            required: true,
            match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format
        },
        endTime: {
            type: String,
            required: true,
            match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
        },
        gracePeriod: {
            type: Number, // in minutes
            default: 15,
            min: 0,
            max: 60
        },
        breakDuration: {
            type: Number, // in minutes
            default: 60,
            min: 0
        }
    },
    // Store office location object directly (not as reference)
    officeLocation: {
        _id: String,
        name: String,
        coordinates: {
            lat: Number,
            lng: Number
        },
        radius: Number,
        address: String
    },
    // Is this schedule active
    isActive: {
        type: Boolean,
        default: true
    },
    // Created by admin/supervisor
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    notes: String
}, {
    timestamps: true
});

// Index for efficient queries
dutyScheduleSchema.index({ user: 1, company: 1, isActive: 1 });
dutyScheduleSchema.index({ company: 1, startDate: 1, endDate: 1 });

// Method to check if schedule applies to a specific date
// dutyScheduleSchema.methods.appliesToDate = function(date) {
//     const checkDate = new Date(date);
//     checkDate.setHours(0, 0, 0, 0);

//     if (this.scheduleType === 'specific') {
//         return this.specificDates.some(specificDate => {
//             const d = new Date(specificDate);
//             d.setHours(0, 0, 0, 0);
//             return d.getTime() === checkDate.getTime();
//         });
//     } else if (this.scheduleType === 'recurring') {
//         // Check if date is within range
//         if (checkDate < new Date(this.startDate)) return false;
//         if (this.endDate && checkDate > new Date(this.endDate)) return false;

//         if (this.recurringPattern === 'daily') {
//             return true;
//         } else if (this.recurringPattern === 'weekly') {
//             const dayOfWeek = checkDate.getDay();
//             return this.weekDays.includes(dayOfWeek);
//         } else if (this.recurringPattern === 'monthly') {
//             const dayOfMonth = checkDate.getDate();
//             return this.monthDays.includes(dayOfMonth);
//         }
//     }
//     return false;
// };

// In your DutySchedule model (models/DutySchedule.js)
dutyScheduleSchema.methods.appliesToDate = function (checkDate) {
    // Normalize dates to start of day in UTC
    const normalizeDate = (date) => {
        const d = new Date(date);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    };

    const normalizedCheckDate = normalizeDate(checkDate);
    console.log('📅 Checking if schedule applies to date:', {
        checkDate: checkDate,
        normalizedCheckDate: normalizedCheckDate.toISOString(),
        scheduleId: this._id,
        scheduleType: this.scheduleType
    });

    if (this.scheduleType === 'specific') {
        // Check specific dates
        if (!this.specificDates || this.specificDates.length === 0) {
            return false;
        }

        const applies = this.specificDates.some(date => {
            const normalizedDate = normalizeDate(date);
            console.log(`Comparing specific date: ${normalizedDate.toISOString()} with check date: ${normalizedCheckDate.toISOString()}`);
            return normalizedDate.getTime() === normalizedCheckDate.getTime();
        });

        console.log(`✅ Specific date applies: ${applies}`);
        return applies;
    }

    if (this.scheduleType === 'recurring') {
        // Check start and end dates
        const normalizedStartDate = this.startDate ? normalizeDate(this.startDate) : null;
        const normalizedEndDate = this.endDate ? normalizeDate(this.endDate) : null;

        console.log('📅 Recurring schedule date ranges:', {
            startDate: normalizedStartDate ? normalizedStartDate.toISOString() : 'None',
            endDate: normalizedEndDate ? normalizedEndDate.toISOString() : 'None',
            checkDate: normalizedCheckDate.toISOString()
        });

        // Check if date is within range
        if (normalizedStartDate && normalizedCheckDate < normalizedStartDate) {
            console.log('❌ Check date is before start date');
            return false;
        }
        if (normalizedEndDate && normalizedCheckDate > normalizedEndDate) {
            console.log('❌ Check date is after end date');
            return false;
        }

        // Check based on recurring pattern
        const dayOfWeek = normalizedCheckDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
        const dayOfMonth = normalizedCheckDate.getUTCDate();

        console.log('📅 Day info:', { dayOfWeek, dayOfMonth });

        switch (this.recurringPattern) {
            case 'daily':
                console.log('✅ Daily schedule applies');
                return true;

            case 'weekly':
                if (!this.weekDays || this.weekDays.length === 0) {
                    console.log('❌ No week days specified for weekly schedule');
                    return false;
                }
                const appliesWeekly = this.weekDays.includes(dayOfWeek);
                console.log(`✅ Weekly schedule applies (day ${dayOfWeek} in ${this.weekDays}): ${appliesWeekly}`);
                return appliesWeekly;

            case 'monthly':
                if (!this.monthDays || this.monthDays.length === 0) {
                    console.log('❌ No month days specified for monthly schedule');
                    return false;
                }
                const appliesMonthly = this.monthDays.includes(dayOfMonth);
                console.log(`✅ Monthly schedule applies (day ${dayOfMonth} in ${this.monthDays}): ${appliesMonthly}`);
                return appliesMonthly;

            default:
                console.log('❌ Unknown recurring pattern:', this.recurringPattern);
                return false;
        }
    }

    console.log('❌ Unknown schedule type:', this.scheduleType);
    return false;
};

module.exports = mongoose.model('DutySchedule', dutyScheduleSchema);