// Type definitions for xdl 0.0.34
// Project: https://github.com/exponentjs/xdl
// Definitions by: Patricio Beltran <https://github.com/patobeltran>

declare module xdl {
    var Exp: {
        publishAsync(root: string, opts?: any): Q.Promise<any>;
    }
    var PackagerController: {
        startAsync(): any;
        stopAsync(): Q.Promise<any>;
    }
}

declare module "xdl" {
    export = xdl;
}