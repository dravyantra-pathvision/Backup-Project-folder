// core/config.dart
// Backend URL configuration.
//
// SWITCHING BETWEEN LOCAL & AWS CLOUD:
// - For local testing (default): AppConfig defaults to local URL ('http://localhost:3000' or 'http://10.0.2.2:3000').
// - To switch to AWS Cloud: Change `useLocalBackend = false` below, or run:
//   flutter run --dart-define=API_BASE_URL=https://16-112-99-7.nip.io
// - Or change the Backend Base URL in Settings -> Connection Settings inside the app.

import 'package:flutter/foundation.dart';

class AppConfig {
  // Flag to toggle between local backend and AWS Cloud backend
  static const bool useLocalBackend = false;

  // AWS Cloud endpoint
  static const String awsApiUrl = 'https://16-112-99-7.nip.io';

  // Local development endpoints
  // Physical devices connected via USB use http://localhost:3000 via adb reverse.
  // Android emulator uses http://10.0.2.2:3000.
  static String get defaultLocalUrl {
    return 'http://localhost:3000';
  }

  static String get apiBaseUrl {
    const String envUrl = String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) {
      return envUrl.replaceAll(RegExp(r'/$'), '');
    }
    return (useLocalBackend ? defaultLocalUrl : awsApiUrl).replaceAll(RegExp(r'/$'), '');
  }

  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://zjmvmgneevskjqpiggau.supabase.co',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXZtZ25lZXZza2pxcGlnZ2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjQxOTksImV4cCI6MjA5NDc0MDE5OX0.1iN2jDclKYwTGdCHhlV9sE3kwQQUx3yXfhjvAT3jQlI',
  );
}
