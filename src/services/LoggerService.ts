import * as FileSystem from "expo-file-system";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Linking, Platform } from "react-native";

const LOG_FILE_PATH = `${(FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || ""}app_crash_logs.txt`;
const SUPPORT_EMAIL = "dipantan755@gmail.com";

export function getLogFilePath(): string {
  return LOG_FILE_PATH;
}

export async function logError(error: any, context: string = "Global"): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    let message = "";
    if (error instanceof Error) {
      message = `${error.name}: ${error.message}\nStack: ${error.stack}`;
    } else if (typeof error === "object") {
      message = JSON.stringify(error, null, 2);
    } else {
      message = String(error);
    }

    const logEntry = `[${timestamp}] [${context}]\n${message}\n----------------------------------------\n\n`;
    console.log("[LoggerService]", logEntry);

    const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
    if (fileInfo.exists) {
      const existingContent = await FileSystem.readAsStringAsync(LOG_FILE_PATH);
      // Keep logs under 500KB to prevent memory issues
      const truncatedContent = existingContent.length > 500000 
        ? existingContent.substring(existingContent.length - 250000) 
        : existingContent;
      await FileSystem.writeAsStringAsync(LOG_FILE_PATH, truncatedContent + logEntry);
    } else {
      await FileSystem.writeAsStringAsync(LOG_FILE_PATH, logEntry);
    }
  } catch (err) {
    console.error("Failed to write log to file:", err);
  }
}

export async function readLogs(): Promise<string> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
    if (fileInfo.exists) {
      return await FileSystem.readAsStringAsync(LOG_FILE_PATH);
    }
    return "No crash logs recorded yet.";
  } catch (err) {
    return `Error reading log file: ${err}`;
  }
}

export async function clearLogs(): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(LOG_FILE_PATH);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(LOG_FILE_PATH);
    }
  } catch (err) {
    console.error("Failed to clear log file:", err);
  }
}

export async function generateErrorReport(error: any, context: string = "ExpoRouter", componentStack?: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const appVersion = Constants.expoConfig?.version || "1.0.0";
  const buildNumber = Constants.expoConfig?.android?.versionCode || 1;
  const osName = Platform.OS;
  const osVersion = Platform.Version;
  const deviceBrand = Device.brand || "UnknownBrand";
  const deviceModel = Device.modelName || "UnknownModel";
  
  let errDetails = "";
  if (error instanceof Error) {
    errDetails = `Type: ${error.name}\nMessage: ${error.message}\nStack Trace:\n${error.stack}`;
  } else if (typeof error === "object") {
    errDetails = JSON.stringify(error, null, 2);
  } else {
    errDetails = String(error);
  }

  let report = `=== SADDHAMMA APP CRASH REPORT ===\n`;
  report += `Timestamp: ${timestamp}\n`;
  report += `App Version: ${appVersion} (Build ${buildNumber})\n`;
  report += `OS: ${osName} ${osVersion}\n`;
  report += `Device: ${deviceBrand} - ${deviceModel}\n`;
  report += `Context: ${context}\n\n`;
  report += `--- ERROR DETAILS ---\n${errDetails}\n\n`;
  if (componentStack) {
    report += `--- COMPONENT STACK ---\n${componentStack}\n\n`;
  }
  
  // Also append recent local log history tail if available
  try {
    const recentLogs = await readLogs();
    if (recentLogs && recentLogs !== "No crash logs recorded yet.") {
      const tail = recentLogs.substring(Math.max(0, recentLogs.length - 2000));
      report += `--- RECENT LOG TAIL ---\n${tail}\n`;
    }
  } catch (e) {
    // ignore
  }

  return report;
}

export async function sendErrorEmail(errorReport: string, customSubject?: string): Promise<void> {
  try {
    const subject = encodeURIComponent(customSubject || "Saddhamma Bug Report");
    // Limit body length in mailto URI to prevent deep link overflow on some email clients
    const safeBody = encodeURIComponent(errorReport.substring(0, 3500));
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${safeBody}`;
    
    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
    } else {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    }
  } catch (err) {
    console.error("Failed to open mail client:", err);
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  }
}

// Global Exception Handler setup
export function initGlobalErrorHandler(): void {
  try {
    const defaultHandler = (ErrorUtils as any).getGlobalHandler ? (ErrorUtils as any).getGlobalHandler() : null;

    (ErrorUtils as any).setGlobalHandler((error: any, isFatal?: boolean) => {
      logError(error, isFatal ? "Fatal Exception" : "Unhandled Exception");
      if (defaultHandler) {
        defaultHandler(error, isFatal);
      }
    });

    // Also intercept console.error
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      originalConsoleError(...args);
      const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      logError(msg, "Console Error");
    };

    console.log("[LoggerService] Global error handler initialized. Log file path:", LOG_FILE_PATH);
  } catch (err) {
    console.error("Failed to initialize global error handler:", err);
  }
}
