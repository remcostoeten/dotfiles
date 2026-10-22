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
	    uninstallCommand: string;
	
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
	        this.uninstallCommand = source["uninstallCommand"];
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
	
	export class PackageSource {
	    method: string;
	    package?: string;
	    shell?: string;
	    args?: string;
	    script?: string;
	    uninstall?: string;
	
	    static createFrom(source: any = {}) {
	        return new PackageSource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.package = source["package"];
	        this.shell = source["shell"];
	        this.args = source["args"];
	        this.script = source["script"];
	        this.uninstall = source["uninstall"];
	    }
	}
	export class PackageEntry {
	    id: string;
	    name: string;
	    category: string;
	    description?: string;
	    disabled?: boolean;
	    checks?: string[];
	    sources: PackageSource[];
	
	    static createFrom(source: any = {}) {
	        return new PackageEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.category = source["category"];
	        this.description = source["description"];
	        this.disabled = source["disabled"];
	        this.checks = source["checks"];
	        this.sources = this.convertValues(source["sources"], PackageSource);
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
	export class PackageCategory {
	    id: string;
	    name: string;
	    description?: string;
	
	    static createFrom(source: any = {}) {
	        return new PackageCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class PackageManifest {
	    version: number;
	    aurHelper: string;
	    categories: PackageCategory[];
	    packages: PackageEntry[];
	
	    static createFrom(source: any = {}) {
	        return new PackageManifest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.aurHelper = source["aurHelper"];
	        this.categories = this.convertValues(source["categories"], PackageCategory);
	        this.packages = this.convertValues(source["packages"], PackageEntry);
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
	export class ImportResult {
	    manifest: PackageManifest;
	    source: string;
	    added: string[];
	    skipped: string[];
	    categories: string[];
	    notes: string[];
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.manifest = this.convertValues(source["manifest"], PackageManifest);
	        this.source = source["source"];
	        this.added = source["added"];
	        this.skipped = source["skipped"];
	        this.categories = source["categories"];
	        this.notes = source["notes"];
	        this.error = source["error"];
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
	
	
	
	
	export class PackagesEnv {
	    packageManager: string;
	    osFamily: string;
	    hasSudo: boolean;
	    aurHelpers: string[];
	    aurHelper: string;
	    methods: Record<string, boolean>;
	
	    static createFrom(source: any = {}) {
	        return new PackagesEnv(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.packageManager = source["packageManager"];
	        this.osFamily = source["osFamily"];
	        this.hasSudo = source["hasSudo"];
	        this.aurHelpers = source["aurHelpers"];
	        this.aurHelper = source["aurHelper"];
	        this.methods = source["methods"];
	    }
	}
	export class ResolvedPackage {
	    id: string;
	    sourceIndex: number;
	    method: string;
	    command: string;
	    uninstallCommand: string;
	    reason: string;
	    installed: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ResolvedPackage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sourceIndex = source["sourceIndex"];
	        this.method = source["method"];
	        this.command = source["command"];
	        this.uninstallCommand = source["uninstallCommand"];
	        this.reason = source["reason"];
	        this.installed = source["installed"];
	    }
	}
	export class PackagesState {
	    path: string;
	    exists: boolean;
	    setupScript: string;
	    manifest: PackageManifest;
	    env: PackagesEnv;
	    resolved: Record<string, ResolvedPackage>;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new PackagesState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.exists = source["exists"];
	        this.setupScript = source["setupScript"];
	        this.manifest = this.convertValues(source["manifest"], PackageManifest);
	        this.env = this.convertValues(source["env"], PackagesEnv);
	        this.resolved = this.convertValues(source["resolved"], ResolvedPackage, true);
	        this.error = source["error"];
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
	    machine: string;
	    gpu: string;
	    storage: string;
	    disks: string;
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
	        this.machine = source["machine"];
	        this.gpu = source["gpu"];
	        this.storage = source["storage"];
	        this.disks = source["disks"];
	        this.hasSudo = source["hasSudo"];
	        this.workspaceRoot = source["workspaceRoot"];
	        this.setupScriptFound = source["setupScriptFound"];
	    }
	}
	export class VerifyResult {
	    id: string;
	    ok: boolean;
	    lines: string[];
	
	    static createFrom(source: any = {}) {
	        return new VerifyResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.ok = source["ok"];
	        this.lines = source["lines"];
	    }
	}

}

