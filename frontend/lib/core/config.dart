// core/config.dart
// Backend URL configuration.
// Set API_BASE_URL at build time: flutter build apk --dart-define=API_BASE_URL=https://your-backend.com
// For local development on emulator the engine falls back to 10.0.2.2:3000 automatically.
class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://zjmvmgneevskjqpiggau.supabase.co',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXZtZ25lZXZza2pxcGlnZ2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNjQxOTksImV4cCI6MjA5NDc0MDE5OX0.1iN2jDclKYwTGdCHhlV9sE3kwQQUx3yXfhjvAT3jQlI',
  );
}
