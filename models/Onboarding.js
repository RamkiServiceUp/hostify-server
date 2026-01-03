const mongoose = require('mongoose');

const onboardingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['host', 'user'],
    required: true,
    index: true,
  },
  // Personal Info
  bio: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  location: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  timezone: {
    type: String,
    default: 'UTC',
    trim: true,
  },
  profilePicture: {
    type: String,
    trim: true,
  },
  
  // Professional Info (for hosts)
  expertise: [{
    type: String,
    trim: true,
  }],
  experience: {
    type: String,
    trim: true,
  },
  linkedinUrl: {
    type: String,
    trim: true,
  },
  websiteUrl: {
    type: String,
    trim: true,
  },
  
  // Preferences (for users)
  interests: [{
    type: String,
    trim: true,
  }],
  learningGoals: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  
  // Notification Preferences
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true,
    },
    push: {
      type: Boolean,
      default: true,
    },
    sms: {
      type: Boolean,
      default: false,
    },
  },
  
  // Onboarding Status
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
onboardingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  if (this.completed && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Onboarding', onboardingSchema);
