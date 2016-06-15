// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for details.

import * as Q from "q";

import {Log} from "../common/log/log";
import {IAppPlatform} from "./platformResolver";
import {IRunOptions} from "../common/launchArgs";
import {RemoteExtension} from "../common/remoteExtension";

export class ExternalPlatform implements IAppPlatform {
    private projectPath: string;
    private remoteExtension: RemoteExtension;

    constructor(private runOptions: IRunOptions, { remoteExtension = RemoteExtension.atProjectRootPath(runOptions.projectRoot) } = {}) {
        this.projectPath = this.runOptions.projectRoot;
        this.remoteExtension = remoteExtension;
    }

    public runApp(): Q.Promise<void> {
        Log.logMessage("Conected to running packager. You can now open your app in the simulator.");
        return Q.resolve<void>(void 0);
    }

    public enableJSDebuggingMode(): Q.Promise<void> {
        Log.logMessage("Debugger ready. Enable remote debugging in app.");
        return Q.resolve<void>(void 0);
    }

    public startPackager(): Q.Promise<void> {
        return this.remoteExtension.getPackagerPort().then(port => {
            Log.logMessage("Attaching to running packager at port: " + port);
        });
    }
}
