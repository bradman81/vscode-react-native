// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import {ErrorHelper} from "../../common/error/errorHelper";
import {IAppPlatform} from "../platformResolver";
import {InternalErrorCode} from "../../common/error/internalErrorCode";
import {IRunOptions} from "../../common/launchArgs";
import {Log} from "../../common/log/log";
import {RemoteExtension} from "../../common/remoteExtension";

import * as Q from "q";

export class ExponentPlatform implements IAppPlatform {
    private runOptions: IRunOptions;
    private remoteExtension: RemoteExtension;
    private exponentTunnelPath: string;

    constructor(runOptions: IRunOptions, { remoteExtension = RemoteExtension.atProjectRootPath(runOptions.projectRoot) } = {}) {
        this.runOptions = runOptions;
        this.remoteExtension = remoteExtension;
        this.exponentTunnelPath = null;
    }

    public runApp(): Q.Promise<void> {
        Log.logMessage(`Application is running on Exponent. Open your exponent app at ${this.exponentTunnelPath} to see it.`);
        return Q.resolve<void>(void 0);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        Log.logMessage("Application is running on Exponent. Please shake device and select 'Debug in Chrome' to enable debugging.");
        return Q.resolve<void>(void 0);
    }

    public startPackager(): Q.Promise<void> {
        return this.remoteExtension.startExponentPackager().then(exponentUrl => {
            if (!exponentUrl) {
                return Q.reject<void>(ErrorHelper.getInternalError(InternalErrorCode.ExpectedExponentTunnelPath,
                "No link provided by exponent. Are you sure your project is correctly setup as an exponent project?"));
            }
            this.exponentTunnelPath = exponentUrl;
        });
    }
}