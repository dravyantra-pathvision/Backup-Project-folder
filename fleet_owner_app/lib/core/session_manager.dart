import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';

/// Manages a 7-day persistent login session using SharedPreferences.
/// Works alongside Firebase Auth's own session persistence.
class SessionManager {
  static const String _sessionKey = 'dy_session_login_time';
  static const String _sessionRoleKey = 'dy_session_role';
  static const int _sessionDurationDays = 7;

  /// Saves the login timestamp and role to persist a 7-day session.
  /// Call this immediately after a successful login.
  static Future<void> saveSession(String role) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setInt(_sessionKey, DateTime.now().millisecondsSinceEpoch);
      await prefs.setString(_sessionRoleKey, role);
    } catch (e) {
      debugPrint('SessionManager.saveSession error: $e');
    }
  }

  /// Clears the saved session. Call this on logout.
  static Future<void> clearSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_sessionKey);
      await prefs.remove(_sessionRoleKey);
    } catch (e) {
      debugPrint('SessionManager.clearSession error: $e');
    }
  }

  /// Returns the saved role if a valid session exists (< 7 days old),
  /// otherwise returns null.
  ///
  /// Note: Firebase currentUser is not required — demo/hardcoded-credential
  /// logins save a session without signing into Firebase.
  static Future<String?> getValidSession() async {
    try {
      final firebaseUser = FirebaseAuth.instance.currentUser;
      if (firebaseUser == null) {
        // No authenticated Firebase user — session invalid
        await clearSession();
        return null;
      }

      final prefs = await SharedPreferences.getInstance();
      final loginTimeMs = prefs.getInt(_sessionKey);
      if (loginTimeMs == null) return null;

      final loginTime = DateTime.fromMillisecondsSinceEpoch(loginTimeMs);
      final daysSinceLogin = DateTime.now().difference(loginTime).inDays;

      if (daysSinceLogin < _sessionDurationDays) {
        return prefs.getString(_sessionRoleKey) ?? 'fleet_owner';
      }

      // Session expired — clean up
      await clearSession();
      await FirebaseAuth.instance.signOut();
      return null;
    } catch (e) {
      debugPrint('SessionManager.getValidSession error: $e');
      return null;
    }
  }
}
