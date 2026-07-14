const profileService = require('./profile.service');
const { logAuditEvent } = require('../../utils/auditLogger');
const fs = require('fs');
const path = require('path');

const getProfile = async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.user.uid);
    res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    // Only allow specific fields
    const allowedFields = ['full_name', 'phone', 'department', 'designation', 'timezone', 'language_pref'];
    const updateData = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const updatedProfile = await profileService.updateProfile(req.user.uid, updateData);
    
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Admin Profile',
      action: 'Profile Updated',
      newValue: updateData
    }, req);

    res.status(200).json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    const updated = await profileService.updateNotificationPreferences(req.user.uid, req.body);
    
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Admin Profile',
      action: 'Notification Preferences Changed',
      newValue: req.body
    }, req);

    res.status(200).json({ message: 'Notification preferences updated', preferences: updated.notification_preferences });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    
    if (!newPassword || newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match or are empty' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Extract current session token to keep it active
    let currentToken = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      currentToken = req.headers.authorization.split(' ')[1];
    }

    await profileService.changePassword(req.user.uid, newPassword);
    
    if (currentToken) {
      await profileService.terminateAllOtherSessions(req.user.uid, currentToken);
    }

    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Admin Profile',
      action: 'Password Changed'
    }, req);

    res.status(200).json({ message: 'Password changed successfully. All other sessions terminated.' });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

const getSessions = async (req, res) => {
  try {
    const sessions = await profileService.getSessions(req.user.uid);
    res.status(200).json(sessions);
  } catch (error) {
    console.error('Error fetching admin sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

const terminateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await profileService.terminateSession(req.user.uid, sessionId);
    
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Admin Profile',
      action: 'Session Terminated',
      newValue: { sessionId }
    }, req);

    res.status(200).json({ message: 'Session terminated successfully' });
  } catch (error) {
    console.error('Error terminating admin session:', error);
    res.status(500).json({ error: 'Failed to terminate session' });
  }
};

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const photoUrl = `/uploads/profiles/${req.file.filename}`;
    await profileService.updateProfilePhoto(req.user.uid, photoUrl);

    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Admin Profile',
      action: 'Profile Photo Updated',
      newValue: { photoUrl }
    }, req);

    res.status(200).json({ message: 'Profile photo updated successfully', photoUrl });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
};

const removePhoto = async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.user.uid);
    
    if (profile.profile_photo) {
      // Remove file from disk
      const filePath = path.join(__dirname, '../../', profile.profile_photo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await profileService.updateProfilePhoto(req.user.uid, null);

    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Admin Profile',
      action: 'Profile Photo Removed'
    }, req);

    res.status(200).json({ message: 'Profile photo removed successfully' });
  } catch (error) {
    console.error('Error removing profile photo:', error);
    res.status(500).json({ error: 'Failed to remove profile photo' });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateNotificationPreferences,
  changePassword,
  getSessions,
  terminateSession,
  uploadPhoto,
  removePhoto
};
