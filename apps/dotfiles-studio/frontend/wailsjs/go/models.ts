export namespace main {
	
	export class CatalogItem {
	    id: string;
	    name: string;
	    description: string;
	    check: string;
	    checks: string[];
	    installable: boolean;
	    available: boolean;
	    availabilityReason: string;
	    method: string;
	    packageName: string;
	    command: string;
	    requiresSudo: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CatalogItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.check = source["check"];
	        this.checks = source["checks"];
	        this.installable = source["installable"];
	        this.available = source["available"];
	        this.availabilityReason = source["availabilityReason"];
	        this.method = source["method"];
	        this.packageName = source["packageName"];
	        this.command = source["command"];
	        this.requiresSudo = source["requiresSudo"];
	    }
	}
	export class CatalogCategory {
	    id: string;
	    name: string;
	    description: string;
	    kind: string;
	    command: string;
	    available: boolean;
	    availabilityReason: string;
	    items: CatalogItem[];
	
	    static createFrom(source: any = {}) {
	        return new CatalogCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.kind = source["kind"];
	        this.command = source["command"];
	        this.available = source["available"];
	        this.availabilityReason = source["availabilityReason"];
	        this.items = this.convertValues(source["items"], CatalogItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class KeydBinding {
	    layer: string;
	    key: string;
	    action: string;
	
	    static createFrom(source: any = {}) {
	        return new KeydBinding(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.layer = source["layer"];
	        this.key = source["key"];
	        this.action = source["action"];
	    }
	}
	export class KeydProfile {
	    name: string;
	    path: string;
	    bindings: KeydBinding[];
	    active: boolean;
	
	    static createFrom(source: any = {}) {
	        return new KeydProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.bindings = this.convertValues(source["bindings"], KeydBinding);
	        this.active = source["active"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KeydResult {
	    ok: boolean;
	    output: string;
	
	    static createFrom(source: any = {}) {
	        return new KeydResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.output = source["output"];
	    }
	}
	export class KeydStatus {
	    installed: boolean;
	    daemonActive: boolean;
	    profilesDir: string;
	    activeProfile: string;
	    systemDirty: boolean;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new KeydStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.installed = source["installed"];
	        this.daemonActive = source["daemonActive"];
	        this.profilesDir = source["profilesDir"];
	        this.activeProfile = source["activeProfile"];
	        this.systemDirty = source["systemDirty"];
	        this.error = source["error"];
	    }
	}
	export class SystemInfo {
	    hostname: string;
	    user: string;
	    os: string;
	    osFamily: string;
	    distro: string;
	    kernel: string;
	    arch: string;
	    desktop: string;
	    sessionType: string;
	    packageManager: string;
	    shell: string;
	    uptime: string;
	    cpu: string;
	    memory: string;
	    hasSudo: boolean;
	    workspaceRoot: string;
	    setupScriptFound: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SystemInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hostname = source["hostname"];
	        this.user = source["user"];
	        this.os = source["os"];
	        this.osFamily = source["osFamily"];
	        this.distro = source["distro"];
	        this.kernel = source["kernel"];
	        this.arch = source["arch"];
	        this.desktop = source["desktop"];
	        this.sessionType = source["sessionType"];
	        this.packageManager = source["packageManager"];
	        this.shell = source["shell"];
	        this.uptime = source["uptime"];
	        this.cpu = source["cpu"];
	        this.memory = source["memory"];
	        this.hasSudo = source["hasSudo"];
	        this.workspaceRoot = source["workspaceRoot"];
	        this.setupScriptFound = source["setupScriptFound"];
	    }
	}

}

