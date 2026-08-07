# Keep bytecode attributes required by Kotlin Reflection & Expo Modules API
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*, RuntimeVisibleAnnotations, RuntimeInvisibleAnnotations, RuntimeVisibleParameterAnnotations, RuntimeInvisibleParameterAnnotations

# Don't warn on missing optional/legacy Expo classes
-dontwarn expo.modules.**
-dontwarn expo.modules.core.interfaces.services.**
-dontwarn expo.modules.kotlin.**
-dontwarn expo.modules.kotlin.types.**
-ignorewarnings

# Keep Expo Modules completely intact
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }
-keepclassmembernames class expo.modules.** { *; }

# Keep Expo Kotlin Types & Reflection
-keep class expo.modules.kotlin.** { *; }
-keepclassmembers class expo.modules.kotlin.** { *; }
-keep class expo.modules.kotlin.types.** { *; }
-keepclassmembers class expo.modules.kotlin.types.** { *; }

# Keep Kotlin stdlib & Reflection
-keep class kotlin.reflect.** { *; }
-keepclassmembers class kotlin.reflect.** { *; }
-keep class kotlin.Metadata { *; }
-keep class kotlin.jvm.internal.** { *; }

# React Native & Native Modules
-keep class com.facebook.react.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**
