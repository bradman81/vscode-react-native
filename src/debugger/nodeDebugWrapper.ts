// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as path from "path";
import * as http from "http";

import {Telemetry} from "../common/telemetry";
import {TelemetryHelper} from "../common/telemetryHelper";
import {RemoteExtension} from "../common/remoteExtension";
import {IOSPlatform} from "./ios/iOSPlatform";
import {ExtensionTelemetryReporter, ReassignableTelemetryReporter} from "../common/telemetryReporters";

export class NodeDebugWrapper {
    private projectRootPath: string;
    private telemetryReporter: ReassignableTelemetryReporter;
    private appName: string;
    private version: string;

    private vscodeDebugAdapterPackage: typeof VSCodeDebugAdapter;
    private nodeDebugSession: typeof NodeDebugSession;

    public constructor(appName: string,
        version: string,
        telemetryReporter: ReassignableTelemetryReporter,
        debugAdapter: typeof VSCodeDebugAdapter,
        debugSession: typeof NodeDebugSession) {
        this.appName = appName;
        this.version = version;
        this.telemetryReporter = telemetryReporter;
        this.vscodeDebugAdapterPackage = debugAdapter;
        this.nodeDebugSession = debugSession;
    }

    public customizeNodeAdapterRequests(): void {
        this.customizeLaunchRequest();
        // this.customizeAttachRequest();
        this.customizeDisconnectRequest();
    }

    /**
     * Intecept the "launchRequest" instance method of NodeDebugSession to interpret arguments
     */
    private customizeLaunchRequest(): void {
        const originalRequest = this.nodeDebugSession.prototype.launchRequest;
        const nodeDebugWrapper = this;

        this.nodeDebugSession.prototype.launchRequest = function (request: any, args: ILaunchArgs) {
            nodeDebugWrapper.projectRootPath = path.resolve(args.program, "../..");
            nodeDebugWrapper.telemetryReporter.reassignTo(new ExtensionTelemetryReporter( // We start to send telemetry
                nodeDebugWrapper.appName, nodeDebugWrapper.version, Telemetry.APPINSIGHTS_INSTRUMENTATIONKEY, nodeDebugWrapper.projectRootPath));

            // Create a server waiting for messages to re-initialize the debug session;
            const reinitializeServer = http.createServer((req, res) => {
                res.statusCode = 404;
                if (req.url === "/refreshBreakpoints") {
                    res.statusCode = 200;
                    if (this) {
                        const sourceMaps = this._sourceMaps;
                        if (sourceMaps) {
                            // Flush any cached source maps
                            sourceMaps._allSourceMaps = {};
                            sourceMaps._generatedToSourceMaps = {};
                            sourceMaps._sourceToGeneratedMaps = {};
                        }
                        // Send an "initialized" event to trigger breakpoints to be re-sent
                        this.sendEvent(new nodeDebugWrapper.vscodeDebugAdapterPackage.InitializedEvent());
                    }
                }
                res.end();
            });
            const debugServerListeningPort = parseInt(args.internalDebuggerPort, 10) || 9090;

            reinitializeServer.listen(debugServerListeningPort);
            reinitializeServer.on("error", (err: Error) => {
                TelemetryHelper.sendSimpleEvent("reinitializeServerError");
                this.sendEvent(new nodeDebugWrapper.vscodeDebugAdapterPackage.OutputEvent("Error in debug adapter server: " + err.toString(), "stderr"));
                this.sendEvent(new nodeDebugWrapper.vscodeDebugAdapterPackage.OutputEvent("Breakpoints may not update. Consider restarting and specifying a different 'internalDebuggerPort' in launch.json"));
            });

            // We do not permit arbitrary args to be passed to our process
            args.args = [
                args.platform,
                debugServerListeningPort.toString(),
                !nodeDebugWrapper.isNullOrUndefined(args.iosRelativeProjectPath) ? args.iosRelativeProjectPath : IOSPlatform.DEFAULT_IOS_PROJECT_RELATIVE_PATH,
                args.target || "simulator",
            ];

            if (!nodeDebugWrapper.isNullOrUndefined(args.logCatArguments)) { // We add the parameter if it's defined (adapter crashes otherwise)
                args.args = args.args.concat([nodeDebugWrapper.parseLogCatArguments(args.logCatArguments)]);
            }

            nodeDebugWrapper.attachRequest(originalRequest, this, request, args);
        };
    }

    /**
     * Intecept the "attachRequest" instance method of NodeDebugSession to interpret arguments
     */
    private attachRequest(launchRequest: (request: any, args: any) => void, debugSession: VSCodeDebugAdapter.DebugSession, request: any, args: any): void {
        launchRequest.call(debugSession, request, args);
    }

    /**
     * Intecept the "disconnectRequest" instance method of NodeDebugSession to interpret arguments
     */
    private customizeDisconnectRequest(): void {
        const originalRequest = this.nodeDebugSession.prototype.disconnectRequest;
        const nodeDebugWrapper = this;

        this.nodeDebugSession.prototype.disconnectRequest = function (response: any, args: any): void {
            try {
                // First we tell the extension to stop monitoring the logcat, and then we disconnect the debugging session
                const remoteExtension = RemoteExtension.atProjectRootPath(nodeDebugWrapper.projectRootPath);
                remoteExtension.stopMonitoringLogcat()
                    .finally(() => originalRequest.call(this, response, args))
                    .done(() => { }, reason => process.stderr.write(`WARNING: Couldn't stop monitoring logcat: ${reason.message || reason}\n`));
            } catch (exception) {
                // This is a "nice to have" feature, so we just fire the message and forget. We don't event handle
                // errors in the response promise
                process.stderr.write(`WARNING: Couldn't stop monitoring logcat. Sync exception: ${exception.message || exception}\n`);
                originalRequest.call(this, response, args);
            }
        }
    }

    private parseLogCatArguments(userProvidedLogCatArguments: any): string {
        return Array.isArray(userProvidedLogCatArguments)
            ? userProvidedLogCatArguments.join(" ") // If it's an array, we join the arguments
            : userProvidedLogCatArguments; // If not, we leave it as-is
    }

    private isNullOrUndefined(value: any): boolean {
        return typeof value === "undefined" || value === null;
    }
}