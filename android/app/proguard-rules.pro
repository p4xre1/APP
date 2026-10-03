# R8 / ProGuard configuration for Fatorati Android builds.
# Keep only the entry points required by Android and Capacitor reflection;
# obfuscate, repackage, and strip debug metadata from everything else.

# Main launcher Activity registered in AndroidManifest.xml.
-keep public class com.fatorati.app.MainActivity {
    public <init>();
}

# Capacitor discovers plugins/bridge methods via annotations and reflection.
# Keep only the plugin class name and its public constructor so internal helper
# methods and fields are obfuscated by R8.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    public <init>();
}
-keep @com.getcapacitor.NativePlugin public class * {
    public <init>();
}
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.Permission <methods>;
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault

# Aggressive R8 obfuscation and class repackaging to hide package/class structure.
-repackageclasses 'o'
-allowaccessmodification
-overloadaggressively

# Replace original Java/Kotlin source file names in bytecode metadata.
-renamesourcefileattribute SourceFile

# Strip verbose, debug, and info Android log calls from compiled bytecode.
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# Optional Capacitor SSL-pinning class probed via Class.forName in try/catch.
-dontwarn io.ionic.sslpinning.**
