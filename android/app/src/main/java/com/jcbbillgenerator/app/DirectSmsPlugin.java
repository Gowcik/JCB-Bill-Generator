package com.jcbbillgenerator.app;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.telephony.SmsManager;
import android.telephony.TelephonyManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(
    name = "DirectSmsPlugin",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { Manifest.permission.SEND_SMS }
        )
    }
)
public class DirectSmsPlugin extends Plugin {

    @PluginMethod
    public void checkSmsPermission(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestSmsPermission(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
        }
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        boolean granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", context.getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to open app settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        String rawPhone = call.getString("phoneNumber");
        String message = call.getString("message");

        if (rawPhone == null || rawPhone.trim().isEmpty()) {
            call.reject("Phone number is required.", "INVALID_PHONE");
            return;
        }

        if (message == null || message.trim().isEmpty()) {
            call.reject("SMS message content is required.", "EMPTY_MESSAGE");
            return;
        }

        Context context = getContext();

        // 1. Permission Check
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Direct SIM SMS permission is unavailable on this device.", "PERMISSION_DENIED");
            return;
        }

        // 2. Cellular Telephony & SIM Verification
        PackageManager pm = context.getPackageManager();
        if (!pm.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)) {
            call.reject("No cellular telephony feature detected on this device.", "NO_TELEPHONY");
            return;
        }

        TelephonyManager tm = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
        if (tm == null || tm.getSimState() == TelephonyManager.SIM_STATE_ABSENT) {
            call.reject("No active SIM card was detected.", "NO_SIM");
            return;
        }

        // 3. Indian Phone Normalization (Preserving +91 without duplication)
        String cleanDigits = rawPhone.replaceAll("\\D", "");
        String formattedPhone;
        if (cleanDigits.length() == 10) {
            formattedPhone = "+91" + cleanDigits;
        } else if (cleanDigits.length() == 12 && cleanDigits.startsWith("91")) {
            formattedPhone = "+" + cleanDigits;
        } else if (cleanDigits.length() == 11 && cleanDigits.startsWith("0")) {
            formattedPhone = "+91" + cleanDigits.substring(1);
        } else if (rawPhone.trim().startsWith("+")) {
            formattedPhone = "+" + cleanDigits;
        } else {
            formattedPhone = cleanDigits;
        }

        // 4. Default SmsManager Resolution (Prefers configured default SMS SIM on dual-SIM devices)
        SmsManager smsManager;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = context.getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }
            if (smsManager == null) {
                smsManager = SmsManager.getDefault();
            }
        } catch (Exception e) {
            smsManager = SmsManager.getDefault();
        }

        if (smsManager == null) {
            call.reject("The phone's SMS service is currently unavailable.", "SERVICE_UNAVAILABLE");
            return;
        }

        // 5. Support Multi-part SMS for messages > 160 characters
        ArrayList<String> parts = smsManager.divideMessage(message);
        final int numParts = parts.size();

        // 6. Delivery Tracking via BroadcastReceiver
        String sentAction = "com.jcbbillgenerator.app.SMS_SENT_" + System.currentTimeMillis();
        Intent sentIntent = new Intent(sentAction);
        sentIntent.setPackage(context.getPackageName());

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent sentPI = PendingIntent.getBroadcast(
            context,
            (int) (System.currentTimeMillis() & 0xfffffff),
            sentIntent,
            pendingFlags
        );

        ArrayList<PendingIntent> sentIntents = new ArrayList<>();
        for (int i = 0; i < numParts; i++) {
            sentIntents.add(sentPI);
        }

        final AtomicInteger completedCount = new AtomicInteger(0);
        final AtomicBoolean hasReported = new AtomicBoolean(false);
        final Handler timeoutHandler = new Handler(Looper.getMainLooper());

        final BroadcastReceiver sentReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                int resultCode = getResultCode();
                if (resultCode == Activity.RESULT_OK) {
                    if (completedCount.incrementAndGet() >= numParts) {
                        if (hasReported.compareAndSet(false, true)) {
                            safelyUnregister(ctx, this);
                            timeoutHandler.removeCallbacksAndMessages(null);
                            JSObject ret = new JSObject();
                            ret.put("success", true);
                            ret.put("parts", numParts);
                            ret.put("recipient", formattedPhone);
                            call.resolve(ret);
                        }
                    }
                } else {
                    if (hasReported.compareAndSet(false, true)) {
                        safelyUnregister(ctx, this);
                        timeoutHandler.removeCallbacksAndMessages(null);

                        String errorMsg = "SMS could not be sent. Please check your SIM network and SMS balance.";
                        String errorCode = "SEND_FAILED";

                        if (resultCode == SmsManager.RESULT_ERROR_NO_SERVICE) {
                            errorMsg = "The phone's SMS service is currently unavailable.";
                            errorCode = "SERVICE_UNAVAILABLE";
                        } else if (resultCode == SmsManager.RESULT_ERROR_RADIO_OFF) {
                            errorMsg = "Cellular radio is off or Airplane mode is active.";
                            errorCode = "RADIO_OFF";
                        } else if (resultCode == SmsManager.RESULT_ERROR_LIMIT_EXCEEDED) {
                            errorMsg = "Device SMS sending limit exceeded.";
                            errorCode = "LIMIT_EXCEEDED";
                        }

                        call.reject(errorMsg, errorCode);
                    }
                }
            }
        };

        // Register receiver for sent broadcast
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.registerReceiver(
                    context,
                    sentReceiver,
                    new IntentFilter(sentAction),
                    ContextCompat.RECEIVER_NOT_EXPORTED
                );
            } else {
                context.registerReceiver(sentReceiver, new IntentFilter(sentAction));
            }
        } catch (Exception e) {
            // If receiver registration fails, proceed to attempt send
        }

        // 15-second safety timeout
        timeoutHandler.postDelayed(() -> {
            if (hasReported.compareAndSet(false, true)) {
                safelyUnregister(context, sentReceiver);
                call.reject("SMS sending timed out. Please check your SIM network signal.", "TIMEOUT");
            }
        }, 15000);

        // 7. Dispatch SMS
        try {
            if (numParts > 1) {
                smsManager.sendMultipartTextMessage(formattedPhone, null, parts, sentIntents, null);
            } else {
                smsManager.sendTextMessage(formattedPhone, null, message, sentPI, null);
            }
        } catch (SecurityException se) {
            if (hasReported.compareAndSet(false, true)) {
                safelyUnregister(context, sentReceiver);
                timeoutHandler.removeCallbacksAndMessages(null);
                call.reject("Direct SIM SMS permission is unavailable on this device.", "PERMISSION_DENIED");
            }
        } catch (Exception e) {
            if (hasReported.compareAndSet(false, true)) {
                safelyUnregister(context, sentReceiver);
                timeoutHandler.removeCallbacksAndMessages(null);
                call.reject("SMS could not be sent: " + e.getMessage(), "SEND_FAILED");
            }
        }
    }

    private void safelyUnregister(Context context, BroadcastReceiver receiver) {
        try {
            context.unregisterReceiver(receiver);
        } catch (Exception ignored) {
            // Receiver already unregistered or not registered
        }
    }
}
